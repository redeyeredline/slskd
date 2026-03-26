namespace slskd.Users.API.DTO
{
    using System.Collections.Generic;
    using Soulseek;

    public class LimitedBrowseResponse
    {
        public List<Directory> Directories { get; set; }
        public int TotalCount { get; set; }
        public int LimitedCount { get; set; }
        public bool IsLimited { get; set; }
        public int Limit { get; set; }
    }

    public class PaginatedBrowseResponse
    {
        public List<Directory> Directories { get; set; }
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public bool HasNextPage { get; set; }
        public bool HasPreviousPage { get; set; }
    }

    public class PaginatedDirectoryResponse
    {
        public List<File> Files { get; set; }
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public bool HasNextPage { get; set; }
        public bool HasPreviousPage { get; set; }
    }

    public class DirectoryChildrenResponse
    {
        public List<Directory> Subdirectories { get; set; }
        public List<File> Files { get; set; }
        public string Separator { get; set; }
    }
}

