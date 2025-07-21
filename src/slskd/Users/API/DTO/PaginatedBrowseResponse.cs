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

using System.Collections.Generic;

namespace slskd.Users.API.DTO
{
    using Soulseek;

    /// <summary>
    ///     Paginated browse response.
    /// </summary>
    public class PaginatedBrowseResponse
    {
        /// <summary>
        ///     Gets or sets the directories for the current page.
        /// </summary>
        public IEnumerable<Directory> Directories { get; set; } = new List<Directory>();

        /// <summary>
        ///     Gets or sets the total count of directories.
        /// </summary>
        public int TotalCount { get; set; }

        /// <summary>
        ///     Gets or sets the current page number.
        /// </summary>
        public int Page { get; set; }

        /// <summary>
        ///     Gets or sets the page size.
        /// </summary>
        public int PageSize { get; set; }

        /// <summary>
        ///     Gets or sets the total number of pages.
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
} 