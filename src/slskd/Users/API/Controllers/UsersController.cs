// <copyright file="UsersController.cs" company="slskd Team">
//     Copyright (c) slskd Team. All rights reserved.
//
//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU Affero General Public License as published
//     by the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.
//
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU Affero General Public License for more details.
//
//     You should have received a copy of the GNU Affero General Public License
//     along with this program.  If not, see https://www.gnu.org/licenses/.
// </copyright>

using Microsoft.Extensions.Options;
using System.Collections.Concurrent;

namespace slskd.Users.API
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
using System.Linq;
    using System.Net;
    using System.Threading.Tasks;
    using Asp.Versioning;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Serilog;
    using slskd.Users.API.DTO;

    using Soulseek;
    using System.Threading;
    using System.IO;

    /// <summary>
    ///     Users.
    /// </summary>
    [Route("api/v{version:apiVersion}/[controller]")]
    [ApiVersion("0")]
    [ApiController]
    [Produces("application/json")]
    [Consumes("application/json")]
    public class UsersController : ControllerBase
    {
        /// <summary>
        ///     Initializes a new instance of the <see cref="UsersController"/> class.
        /// </summary>
        /// <param name="soulseekClient"></param>
        /// <param name="browseTracker"></param>
        /// <param name="userService"></param>
        /// <param name="optionsSnapshot"></param>
        public UsersController(ISoulseekClient soulseekClient, IBrowseTracker browseTracker, IUserService userService, IOptionsSnapshot<Options> optionsSnapshot)
        {
            Client = soulseekClient;
            BrowseTracker = browseTracker;
            Users = userService;
            OptionsSnapshot = optionsSnapshot;
        }

        private IBrowseTracker BrowseTracker { get; }
        private ISoulseekClient Client { get; }
        private IUserService Users { get; }
        private IOptionsSnapshot<Options> OptionsSnapshot { get; }
        private ILogger Log { get; set; } = Serilog.Log.ForContext<UsersController>();

        private static readonly ConcurrentDictionary<string, List<Soulseek.Directory>> DirectoryCache = new();

        /// <summary>
        ///     Retrieves the address of the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <returns></returns>
        /// <response code="200">The request completed successfully.</response>
        [HttpGet("{username}/endpoint")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(IPEndPoint), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Endpoint([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                var endpoint = await Users.GetIPEndPointAsync(username);
                return Ok(endpoint);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
        }

        /// <summary>
        ///     Retrieves the files shared by the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <returns></returns>
        [HttpGet("{username}/browse")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(IEnumerable<Soulseek.Directory>), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Browse([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                // Clear the cache for all users except the current one
                foreach (var key in DirectoryCache.Keys)
                {
                    if (key != username)
                    {
                        DirectoryCache.TryRemove(key, out _);
                        Log.Information("[DirectoryCache] Removed cache for user {Username}", key);
                    }
                }

                var result = await Client.BrowseAsync(username);
                DirectoryCache[username] = result.Directories.ToList();
                Log.Information("[DirectoryCache] Cached {Count} directories for user {Username}", result.Directories.Count(), username);

                _ = Task.Run(async () =>
                {
                    await Task.Delay(5000);
                    BrowseTracker.TryRemove(username);
                });

                return Ok(result);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpPost("{username}/browse/refresh")]
        [Authorize(Policy = AuthPolicy.Any)]
        public async Task<IActionResult> RefreshBrowse([FromRoute, Required] string username)
        {
            DirectoryCache.TryRemove(username, out _);
            Log.Information("[DirectoryCache] Cache cleared for user {Username}", username);
            // Trigger a fresh browse and cache build
            return await Browse(username);
        }

        /// <summary>
        ///     Retrieves a limited browse response for users with massive file counts to prevent server crashes.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <param name="limit">Maximum number of directories to return (default 1000).</param>
        /// <returns></returns>
        [HttpGet("{username}/browse/limited")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(LimitedBrowseResponse), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> BrowseLimited(
            [FromRoute, Required] string username,
            [FromQuery] int limit = 1000)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            if (limit < 1 || limit > 10000) limit = 1000;

            try
            {
                Log.Information("Fetching limited browse response for user {User} with limit {Limit}", username, limit);
                
                using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(120000)); // 2 minute timeout for massive users
                var browseResponse = await Client.BrowseAsync(username).WaitAsync(cts.Token);
                
                var limitedDirectories = browseResponse.Directories.Take(limit).ToList();
                var totalCount = browseResponse.Directories.Count;
                var isLimited = totalCount > limit;

                var response = new LimitedBrowseResponse
                {
                    Directories = limitedDirectories,
                    TotalCount = totalCount,
                    LimitedCount = limitedDirectories.Count,
                    IsLimited = isLimited,
                    Limit = limit,
                };

                Log.Information("Limited browse response for user {User}: {LimitedCount}/{TotalCount} directories returned", 
                    username, limitedDirectories.Count, totalCount);

                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
            catch (OperationCanceledException)
            {
                Log.Warning("Timeout while fetching limited browse for user {User}", username);
                return StatusCode(408, "Browse request timed out - user may have too many files");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error fetching limited browse for user {User}: {Message}", username, ex.Message);
                return StatusCode(500, "Failed to browse user - server may be overwhelmed");
            }
        }

        /// <summary>
        ///     Retrieves a paginated list of directories from the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <param name="page">The page number (1-based).</param>
        /// <param name="pageSize">The number of items per page.</param>
        /// <param name="search">Optional search term to filter directories.</param>
        /// <returns></returns>
        [HttpGet("{username}/browse/paginated")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(PaginatedBrowseResponse), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> BrowsePaginated(
            [FromRoute, Required] string username,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string search = null)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 1000) pageSize = 100;

            try
            {
                var browseResponse = await Client.BrowseAsync(username);
                var result = browseResponse.Directories;
                
                // Filter directories if search term is provided
                var filteredDirectories = result;
                if (!string.IsNullOrEmpty(search))
                {
                    filteredDirectories = result.Where(d => 
                        d.Name.Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                var totalCount = filteredDirectories.Count();
                var totalPages = (int)System.Math.Ceiling((double)totalCount / pageSize);
                
                var pagedDirectories = filteredDirectories
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var response = new PaginatedBrowseResponse
                {
                    Directories = pagedDirectories,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = totalPages,
                    HasNextPage = page < totalPages,
                    HasPreviousPage = page > 1,
                };

                _ = Task.Run(async () =>
                {
                    await Task.Delay(5000);
                    BrowseTracker.TryRemove(username);
                });

                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
        }

        /// <summary>
        ///     Retrieves the status of the current browse operation for the specified <paramref name="username"/>, if any.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <returns></returns>
        [HttpGet("{username}/browse/status")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(decimal), 200)]
        [ProducesResponseType(404)]
        public IActionResult BrowseStatus([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            if (BrowseTracker.TryGet(username, out var progress))
            {
                return Ok(progress);
            }

            return NotFound();
        }

        /// <summary>
        ///     Retrieves the files from the specified directory from the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <param name="request">The directory contents request.</param>
        /// <returns></returns>
        [HttpPost("{username}/directory")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(IEnumerable<Soulseek.Directory>), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Directory([FromRoute, Required] string username, [FromBody, Required] DirectoryContentsRequest request)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            if (request == null || string.IsNullOrEmpty(request.Directory))
            {
                return BadRequest();
            }

            try
            {
                Log.Debug("Fetching directory contents for user {User} directory '{Directory}'", username, request.Directory);
                
                using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(60000)); // 60 second timeout
                var result = await Client.GetDirectoryContentsAsync(username, request.Directory)
                    .WaitAsync(cts.Token);

                if (result != null && result.Any())
                {
                Log.Debug("{Endpoint} response from {User} for directory '{Directory}': {@Response}", nameof(Directory), username, request.Directory, result);
                return Ok(result);
                }
                else
                {
                    Log.Warning("No files found in directory '{Directory}' for user {User}", request.Directory, username);
                    return NotFound();
                }
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
            catch (OperationCanceledException)
            {
                Log.Warning("Timeout while fetching directory '{Directory}' for user {User}", request.Directory, username);
                return StatusCode(408, "Request timeout");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error fetching directory '{Directory}' for user {User}: {Message}", request.Directory, username, ex.Message);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        ///     Retrieves a paginated list of files from the specified directory from the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <param name="directory">The directory path.</param>
        /// <param name="page">The page number (1-based).</param>
        /// <param name="pageSize">The number of items per page.</param>
        /// <param name="search">Optional search term to filter files.</param>
        /// <returns></returns>
        [HttpGet("{username}/directory/{directory}/paginated")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(PaginatedDirectoryResponse), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> DirectoryPaginated(
            [FromRoute, Required] string username,
            [FromRoute, Required] string directory,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string search = null)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 1000) pageSize = 100;

            try
            {
                Log.Debug("Fetching paginated directory contents for user {User} directory '{Directory}'", username, directory);
                
                using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(60000)); // 60 second timeout
                var result = await Client.GetDirectoryContentsAsync(username, directory)
                    .WaitAsync(cts.Token);

                if (!result.Any())
                {
                    Log.Warning("No files found in directory '{Directory}' for user {User}", directory, username);
                    return NotFound();
                }

                var directoryResult = result.FirstOrDefault();
                if (directoryResult?.Files == null)
                {
                    Log.Warning("No files found in directory '{Directory}' for user {User}", directory, username);
                    return NotFound();
                }

                // Filter files if search term is provided
                var filteredFiles = directoryResult.Files;
                if (!string.IsNullOrEmpty(search))
                {
                    filteredFiles = directoryResult.Files.Where(f => 
                        f.Filename.Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                var totalCount = filteredFiles.Count();
                var totalPages = (int)System.Math.Ceiling((double)totalCount / pageSize);
                
                var pagedFiles = filteredFiles
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var response = new PaginatedDirectoryResponse
                {
                    Files = pagedFiles,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = totalPages,
                    HasNextPage = page < totalPages,
                    HasPreviousPage = page > 1,
                };

                Log.Debug("{Endpoint} paginated response from {User} for directory '{Directory}': {FileCount} files, page {Page}/{TotalPages}", 
                    nameof(DirectoryPaginated), username, directory, pagedFiles.Count, page, totalPages);

                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
            catch (OperationCanceledException)
            {
                Log.Warning("Timeout while fetching paginated directory '{Directory}' for user {User}", directory, username);
                return StatusCode(408, "Request timeout");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error fetching paginated directory '{Directory}' for user {User}: {Message}", directory, username, ex.Message);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        ///     Returns the immediate children (subdirectories and files) of a given directory for a user.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <param name="parent">The parent directory path (empty or null for root).</param>
        /// <returns></returns>
        [HttpGet("{username}/directory-children")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(DirectoryChildrenResponse), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> DirectoryChildren(
            [FromRoute, Required] string username,
            [FromQuery] string parent = null)
        {
            Log.Information("[DirectoryChildren] START: username={Username}, parent={Parent}", username, parent);
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                if (!DirectoryCache.TryGetValue(username, out var allDirs))
                {
                    Log.Warning("[DirectoryCache] Cache miss for user {Username}. Triggering cache build.", username);
                    // Trigger cache build
                    await Browse(username);
                    return StatusCode(202, "Directory cache is being built. Please retry shortly.");
                }
                Log.Information("[DirectoryCache] Cache hit for user {Username}: {Count} directories", username, allDirs.Count);

                // Normalize parent path
                parent = string.IsNullOrEmpty(parent) ? string.Empty : parent.TrimEnd('/', '\\');

                // Find immediate children
                var separator = '\\';
                if (allDirs.Any(d => d.Name.Contains('/'))) separator = '/';

                var children = allDirs
                    .Where(d =>
                    {
                        // Must be a direct child of parent
                        var rel = parent == string.Empty ? d.Name : d.Name.StartsWith(parent + separator) ? d.Name.Substring(parent.Length + 1) : null;
                        if (rel == null) return false;
                        if (rel.Contains(separator)) return false; // Only immediate children
                        return parent == string.Empty ? !d.Name.Contains(separator) : rel != null && !rel.Contains(separator);
                    })
                    .ToList();

                Log.Information("[DirectoryChildren] {Count} immediate children found for user {Username}, parent={Parent}", children.Count, username, parent);

                // Find files in the parent directory
                var parentDir = allDirs.FirstOrDefault(d => d.Name == parent);
                var files = parentDir?.Files ?? new List<Soulseek.File>();

                var response = new DirectoryChildrenResponse
                {
                    Subdirectories = children,
                    Files = files,
                    Separator = separator.ToString(),
                };

                Log.Information("[DirectoryChildren] END: username={Username}, parent={Parent}, childrenCount={Count}, fileCount={FileCount}", username, parent, children.Count, files.Count);
                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                Log.Error(ex, "[DirectoryChildren] UserOfflineException for user {Username}, parent={Parent}: {Message}", username, parent, ex.Message);
                return NotFound(ex.Message);
            }
            catch (OperationCanceledException)
            {
                Log.Warning("[DirectoryChildren] Timeout while fetching children for user {Username}, parent={Parent}", username, parent);
                return StatusCode(408, "Request timeout");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "[DirectoryChildren] Exception for user {Username}, parent={Parent}: {Message}", username, parent, ex.Message);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        ///     Retrieves information about the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <returns></returns>
        [HttpGet("{username}/info")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(Info), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Info([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                var response = await Users.GetInfoAsync(username);
                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
        }

        /// <summary>
        ///     Retrieves status for the specified <paramref name="username"/>.
        /// </summary>
        /// <param name="username">The username of the user.</param>
        /// <returns></returns>
        [HttpGet("{username}/status")]
        [Authorize(Policy = AuthPolicy.Any)]
        [ProducesResponseType(typeof(Status), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Status([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                var response = await Users.GetStatusAsync(username);
                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}