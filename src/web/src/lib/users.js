import api from './api';

export const getInfo = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/info`);
};

export const getStatus = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/status`);
};

export const getEndpoint = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/endpoint`);
};

export const browse = async ({ username }) => {
  return (
    await api.get(`/users/${encodeURIComponent(username)}/browse`, {
      timeout: 60_000,
    })
  ).data;
};

export const browseLimited = async ({ username, limit = 1000 }) => {
  return (
    await api.get(`/users/${encodeURIComponent(username)}/browse/limited?limit=${limit}`, {
      timeout: 120_000, // 2 minute timeout for massive users
    })
  ).data;
};

export const browsePaginated = async ({
  username,
  page = 1,
  pageSize = 100,
  search = null,
}) => {
  const parameters = new URLSearchParams();
  if (page) parameters.append('page', page);
  if (pageSize) parameters.append('pageSize', pageSize);
  if (search) parameters.append('search', search);

  return (
    await api.get(
      `/users/${encodeURIComponent(username)}/browse/paginated?${parameters.toString()}`,
      { timeout: 60_000 }, // 60 second timeout for large browse requests
    )
  ).data;
};

export const getBrowseStatus = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/browse/status`);
};

export const getDirectoryContents = async ({ username, directory }) => {
  return (
    await api.post(
      `/users/${encodeURIComponent(username)}/directory`,
      {
      directory,
      },
      {
        timeout: 15_000, // 15 second timeout for directory contents
      },
    )
  ).data;
};

export const getDirectoryContentsPaginated = async ({
  username,
  directory,
  page = 1,
  pageSize = 100,
  search = null,
}) => {
  const parameters = new URLSearchParams();
  if (page) parameters.append('page', page);
  if (pageSize) parameters.append('pageSize', pageSize);
  if (search) parameters.append('search', search);

  return (
    await api.get(
      `/users/${encodeURIComponent(username)}/directory/${encodeURIComponent(directory)}/paginated?${parameters.toString()}`,
    )
  ).data;
};

export const getDirectoryChildren = async ({ username, parent = '' }) => {
  const params = parent ? `?parent=${encodeURIComponent(parent)}` : '';
  return (
    await api.get(`/users/${encodeURIComponent(username)}/directory-children${params}`, {
      timeout: 30_000,
    })
  ).data;
};
