// <copyright file="PaginatedBrowseResponse.cs" company="slskd Team">
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

namespace slskd.Users.API.DTO
{
    using System.Collections.Generic;
    using Soulseek;

    /// <summary>
    ///     A paginated browse response.
    /// </summary>
    public class PaginatedBrowseResponse
    {
        /// <summary>
        ///     Gets or sets the directories.
        /// </summary>
        public IEnumerable<Soulseek.Directory> Directories { get; set; }

        /// <summary>
        ///     Gets or sets the total count.
        /// </summary>
        public int TotalCount { get; set; }

        /// <summary>
        ///     Gets or sets the page.
        /// </summary>
        public int Page { get; set; }

        /// <summary>
        ///     Gets or sets the page size.
        /// </summary>
        public int PageSize { get; set; }

        /// <summary>
        ///     Gets or sets the total pages.
        /// </summary>
        public int TotalPages { get; set; }

        /// <summary>
        ///     Gets or sets a value indicating whether there is a next page.
        /// </summary>
        public bool HasNextPage { get; set; }

        /// <summary>
        ///     Gets or sets a value indicating whether there is a previous page.
        /// </summary>
        public bool HasPreviousPage { get; set; }
    }

    /// <summary>
    ///     A limited browse response for users with massive file counts.
    /// </summary>
    public class LimitedBrowseResponse
    {
        /// <summary>
        ///     Gets or sets the directories (limited subset).
        /// </summary>
        public IEnumerable<Soulseek.Directory> Directories { get; set; }

        /// <summary>
        ///     Gets or sets the total count of directories in the user's share.
        /// </summary>
        public int TotalCount { get; set; }

        /// <summary>
        ///     Gets or sets the number of directories returned in this response.
        /// </summary>
        public int LimitedCount { get; set; }

        /// <summary>
        ///     Gets or sets a value indicating whether the response was limited.
        /// </summary>
        public bool IsLimited { get; set; }

        /// <summary>
        ///     Gets or sets the limit applied to this response.
        /// </summary>
        public int Limit { get; set; }
    }

    /// <summary>
    ///     Response for immediate children of a directory.
    /// </summary>
    public class DirectoryChildrenResponse
    {
        public IEnumerable<Soulseek.Directory> Subdirectories { get; set; }
        public IEnumerable<Soulseek.File> Files { get; set; }
        public string Separator { get; set; }
    }
} 