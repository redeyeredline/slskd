// <copyright file="LocalIpBypassAuthentication.cs" company="slskd Team">
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

using System;
using System.Linq;
using System.Net;
using System.Security.Principal;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTools;
using slskd.Authentication;

namespace slskd.Common.Authentication
{
    /// <summary>
    ///     Local IP bypass authentication.
    /// </summary>
    public static class LocalIpBypassAuthentication
    {
        /// <summary>
        ///     Gets the local IP bypass authentication scheme name.
        /// </summary>
        public static string AuthenticationScheme { get; } = "LocalIpBypass";
    }

    /// <summary>
    ///     Handles local IP bypass authentication.
    /// </summary>
    public class LocalIpBypassAuthenticationHandler : AuthenticationHandler<LocalIpBypassAuthenticationOptions>
    {
        /// <summary>
        ///     Initializes a new instance of the <see cref="LocalIpBypassAuthenticationHandler"/> class.
        /// </summary>
        /// <param name="options">The options monitor.</param>
        /// <param name="logger">A logger factory.</param>
        /// <param name="urlEncoder">A url encoder.</param>
        public LocalIpBypassAuthenticationHandler(
            IOptionsMonitor<LocalIpBypassAuthenticationOptions> options,
            ILoggerFactory logger,
            UrlEncoder urlEncoder)
            : base(options, logger, urlEncoder)
        {
        }

        /// <summary>
        ///     Authenticates via local IP bypass.
        /// </summary>
        /// <returns>A successful authentication result containing a ticket for the local IP user.</returns>
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            await Task.Yield();

            // Get the real client IP address, considering X-Forwarded-For header for Docker/reverse proxy scenarios
            var clientIpAddress = GetClientIpAddress();

            if (clientIpAddress == null)
            {
                return AuthenticateResult.NoResult();
            }

            // Check if the client IP is in any of the configured local IP ranges
            var isLocalIp = Options.Cidr.Split(',')
                .Select(cidr => IPAddressRange.Parse(cidr))
                .Any(range => range.Contains(clientIpAddress));

            if (!isLocalIp)
            {
                return AuthenticateResult.NoResult();
            }

            // Create identity and principal for the local IP user
            var identity = new GenericIdentity($"LocalIP-{clientIpAddress}");
            var principal = new GenericPrincipal(identity, new[] { Options.Role.ToString() });
            var ticket = new AuthenticationTicket(principal, new AuthenticationProperties(), LocalIpBypassAuthentication.AuthenticationScheme);

            return AuthenticateResult.Success(ticket);
        }

        /// <summary>
        ///     Gets the real client IP address, considering X-Forwarded-For header.
        /// </summary>
        /// <returns>The real client IP address.</returns>
        private IPAddress GetClientIpAddress()
        {
            // First, try to get the IP from X-Forwarded-For header (for Docker/reverse proxy scenarios)
            if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
            {
                var forwardedIp = forwardedFor.ToString().Split(',')[0].Trim();
                if (IPAddress.TryParse(forwardedIp, out var ip))
                {
                    return ip;
                }
            }

            // Fall back to X-Real-IP header (used by some reverse proxies)
            if (Request.Headers.TryGetValue("X-Real-IP", out var realIp))
            {
                var realIpString = realIp.ToString().Trim();
                if (IPAddress.TryParse(realIpString, out var ip))
                {
                    return ip;
                }
            }

            // Finally, fall back to the direct connection IP
            return Request.HttpContext.Connection.RemoteIpAddress;
        }
    }

    /// <summary>
    ///     Local IP bypass authentication options.
    /// </summary>
    public class LocalIpBypassAuthenticationOptions : AuthenticationSchemeOptions
    {
        /// <summary>
        ///     Gets or sets the comma separated list of CIDRs that are considered local.
        /// </summary>
        public string Cidr { get; set; } = "127.0.0.1/32,::1/128,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12";

        /// <summary>
        ///     Gets or sets the role assigned to local IP bypass users.
        /// </summary>
        public Role Role { get; set; } = Role.Administrator;
    }
} 