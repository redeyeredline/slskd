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
    await api.post(`/users/${encodeURIComponent(username)}/directory`, {
      directory,
    })
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
