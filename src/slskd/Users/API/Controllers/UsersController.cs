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
        [ProducesResponseType(typeof(IEnumerable<Directory>), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> Browse([FromRoute, Required] string username)
        {
            if (Program.IsRelayAgent)
            {
                return Forbid();
            }

            try
            {
                var result = await Client.BrowseAsync(username);

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
        [ProducesResponseType(typeof(IEnumerable<Directory>), 200)]
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
                var result = await Client.GetDirectoryContentsAsync(username, request.Directory);

                Log.Debug("{Endpoint} response from {User} for directory '{Directory}': {@Response}", nameof(Directory), username, request.Directory, result);

                return Ok(result);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
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
                var directories = await Client.GetDirectoryContentsAsync(username, directory);
                var result = directories.FirstOrDefault();

                if (result == null)
                {
                    return NotFound("Directory not found");
                }

                // Filter files if search term is provided
                var filteredFiles = result.Files;
                if (!string.IsNullOrEmpty(search))
                {
                    filteredFiles = result.Files.Where(f => 
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
                    Directory = result,
                    Files = pagedFiles,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = totalPages,
                    HasNextPage = page < totalPages,
                    HasPreviousPage = page > 1,
                };

                Log.Debug("{Endpoint} paginated response from {User} for directory '{Directory}': {@Response}", nameof(DirectoryPaginated), username, directory, response);

                return Ok(response);
            }
            catch (UserOfflineException ex)
            {
                return NotFound(ex.Message);
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