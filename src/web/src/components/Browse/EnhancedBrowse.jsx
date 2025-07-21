import './EnhancedBrowse.css';
import * as users from '../../lib/users';
import PlaceholderSegment from '../Shared/PlaceholderSegment';
import Directory from './Directory';
import VirtualDirectoryTree from './VirtualDirectoryTree';
import * as lzString from 'lz-string';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import {
  Card,
  Icon,
  Input,
  Loader,
  Pagination,
  Segment,
} from 'semantic-ui-react';

const initialState = {
  browseError: undefined,
  browseState: 'idle',
  browseStatus: 0,
  currentPage: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  info: {
    directories: 0,
    files: 0,
    lockedDirectories: 0,
    lockedFiles: 0,
  },
  interval: undefined,
  pageSize: 100,
  searchTerm: '',
  searchTimeout: null,
  selectedDirectory: {},
  selectedFiles: [],
  separator: '\\',
  totalCount: 0,
  totalPages: 0,
  tree: [],
  username: '',
  useVirtualization: true,
};

class EnhancedBrowse extends Component {
  constructor(props) {
    super(props);

    this.state = initialState;
  }

  componentDidMount() {
    this.fetchStatus();
    this.loadState();
    this.setState(
      {
        interval: window.setInterval(this.fetchStatus, 500),
      },
      () => this.saveState(),
    );
    if (this.props.location.state?.user) {
      this.setState({ username: this.props.location.state.user }, this.browse);
    }

    document.addEventListener('keyup', this.keyUp, false);
  }

  componentWillUnmount() {
    clearInterval(this.state.interval);
    this.setState({ interval: undefined });
    document.removeEventListener('keyup', this.keyUp, false);
  }

  browse = async (usePagination = true) => {
    const { currentPage, pageSize, searchTerm, username } = this.state;

    // Don't browse if username is empty
    if (!username || username.trim() === '') {
      return;
    }

    this.setState(
      { browseError: undefined, browseState: 'pending', username },
      async () => {
        try {
          let response;

          if (usePagination) {
            response = await users.browsePaginated({
              page: currentPage,
              pageSize,
              search: searchTerm,
              username,
            });

            const {
              directories,
              hasNextPage,
              hasPreviousPage,
              page,
              pageSize: respPageSize,
              totalCount,
              totalPages,
            } = response;

            this.setState({
              currentPage: page,
              hasNextPage,
              hasPreviousPage,
              info: {
                directories: totalCount,
                files: 0,
                lockedDirectories: 0,
                lockedFiles: 0,
              },
              pageSize: respPageSize,
              totalCount,
              totalPages,
              tree: this.getDirectoryTree({ directories, separator: '\\' }),
            });
          } else {
            // Fallback to original API for small datasets
            response = await users.browse({ username });

            let { directories } = response;
            const { lockedDirectories } = response;

            const directoryCount = directories.length;
            const fileCount = directories.reduce((accumulator, directory) => {
              return accumulator + directory.fileCount;
            }, 0);

            const lockedDirectoryCount = lockedDirectories.length;
            const lockedFileCount = lockedDirectories.reduce(
              (accumulator, directory) => accumulator + directory.fileCount,
              0,
            );

            directories = directories.concat(
              lockedDirectories.map((d) => ({ ...d, locked: true })),
            );

            this.setState({
              info: {
                directories: directoryCount,
                files: fileCount,
                lockedDirectories: lockedDirectoryCount,
                lockedFiles: lockedFileCount,
              },
              separator: '\\',
              tree: this.getDirectoryTree({ directories, separator: '\\' }),
            });
          }

          this.setState(
            { browseError: undefined, browseState: 'complete' },
            () => {
              this.saveState();
            },
          );
        } catch (error) {
          this.setState({ browseError: error, browseState: 'error' });
        }
      },
    );
  };

  handleUsernameChange = (event, { value }) => {
    this.setState({ username: value });
  };

  handleSearchChange = (event, { value }) => {
    const { searchTimeout, username } = this.state;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    this.setState({ searchTerm: value });

    // Only search if we have a username
    if (username && username.trim() !== '') {
      // Debounce search to avoid too many API calls
      const timeout = setTimeout(() => {
        this.setState({ currentPage: 1 }, () => {
          this.browse(true);
        });
      }, 500);

      this.setState({ searchTimeout: timeout });
    }
  };

  handlePageChange = (event, { activePage }) => {
    const { username } = this.state;
    if (username && username.trim() !== '') {
      this.setState({ currentPage: activePage }, () => {
        this.browse(true);
      });
    }
  };

  clear = () => {
    this.setState(initialState, () => {
      this.saveState();
      this.inputtext.focus();
    });
  };

  keyUp = (event) => (event.key === 'Escape' ? this.clear() : '');

  saveState = () => {
    this.inputtext.inputRef.current.disabled =
      this.state.browseState !== 'idle';

    const storeToLocalStorage = () => {
      try {
        localStorage.setItem(
          'soulseek-enhanced-browse-state',
          lzString.compress(JSON.stringify(this.state)),
        );
      } catch (error) {
        console.error(error);
      }
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(storeToLocalStorage);
    } else {
      setTimeout(storeToLocalStorage, 0);
    }
  };

  loadState = () => {
    try {
      const savedState = localStorage.getItem('soulseek-enhanced-browse-state');
      if (savedState && !this.props.location.state?.user) {
        const decompressed = lzString.decompress(savedState);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          this.setState(parsed);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading state from localStorage:', error);
    }

    // Fallback to initialState
    this.setState(initialState);
  };

  fetchStatus = async () => {
    const { browseState, username } = this.state;
    if (browseState === 'pending' && username && username.trim() !== '') {
      try {
        const response = await users.getBrowseStatus({ username });
        this.setState({
          browseStatus: response.data,
        });
      } catch (error) {
        console.error('Error fetching browse status:', error);
      }
    }
  };

  getDirectoryTree = ({ directories, separator }) => {
    if (directories.length === 0 || directories[0].name === undefined) {
      return [];
    }

    const depthMap = new Map();
    for (const d of directories) {
      const directoryDepth = d.name.split(separator).length;
      if (!depthMap.has(directoryDepth)) {
        depthMap.set(directoryDepth, []);
      }

      depthMap.get(directoryDepth).push(d);
    }

    const depth = Math.min(...Array.from(depthMap.keys()));

    return depthMap
      .get(depth)
      .map((directory) =>
        this.getChildDirectories(depthMap, directory, separator, depth + 1),
      );
  };

  getChildDirectories = (depthMap, root, separator, depth) => {
    if (!depthMap.has(depth)) {
      return { ...root, children: [] };
    }

    const children = depthMap
      .get(depth)
      .filter((d) => d.name.startsWith(root.name));

    return {
      ...root,
      children: children.map((c) =>
        this.getChildDirectories(depthMap, c, separator, depth + 1),
      ),
    };
  };

  selectDirectory = async (directory) => {
    const { username } = this.state;

    this.setState(
      { selectedDirectory: { ...directory, children: [] } },
      async () => {
        try {
          // Fetch directory contents
          const response = await users.getDirectoryContents({
            directory: directory.name,
            username,
          });

          this.setState(
            {
              selectedDirectory: {
                ...directory,
                children: [],
                files: response,
              },
            },
            () => this.saveState(),
          );
        } catch (error) {
          console.error('Error fetching directory contents:', error);
          // Still save the state even if directory contents fail to load
          this.saveState();
        }
      },
    );
  };

  handleDeselectDirectory = () => {
    this.setState({ selectedDirectory: initialState.selectedDirectory }, () =>
      this.saveState(),
    );
  };

  render() {
    const {
      browseError,
      browseState,
      browseStatus,
      currentPage,
      info,
      searchTerm,
      selectedDirectory,
      separator,
      totalCount,
      totalPages,
      tree,
      username,
    } = this.state;
    const { locked, name } = selectedDirectory;
    const pending = browseState === 'pending';

    const emptyTree = !(tree && tree.length > 0);

    const files = (selectedDirectory.files || []).map((f) => ({
      ...f,
      filename: `${name}${separator}${f.filename}`,
    }));

    return (
      <div className="search-container">
        <Segment
          className="browse-segment"
          raised
        >
          <div className="browse-segment-icon">
            <Icon
              name="folder open"
              size="big"
            />
          </div>
          <Input
            action={
              !pending &&
              (browseState === 'idle'
                ? { icon: 'search', onClick: () => this.browse(true) }
                : { color: 'red', icon: 'x', onClick: this.clear })
            }
            className="search-input"
            disabled={pending}
            loading={pending}
            onChange={this.handleUsernameChange}
            onKeyUp={(event) =>
              event.key === 'Enter' ? this.browse(true) : ''
            }
            placeholder="Username"
            ref={(input) => (this.inputtext = input)}
            size="big"
            value={username}
          />
        </Segment>

        {pending ? (
          <Loader
            active
            className="search-loader"
            inline="centered"
            size="big"
          >
            Downloaded {Math.round(browseStatus.percentComplete || 0)}% of
            Response
          </Loader>
        ) : (
          <div>
            {browseError ? (
              <span className="browse-error">Failed to browse {username}</span>
            ) : (
              <div className="browse-container">
                {emptyTree ? (
                  <PlaceholderSegment
                    caption="No user share to display"
                    icon="folder open"
                  />
                ) : (
                  <Card
                    className="browse-tree-card"
                    raised
                  >
                    <Card.Content>
                      <Card.Header>
                        <Icon
                          color="green"
                          name="circle"
                        />
                        {username}
                      </Card.Header>
                      <Card.Meta className="browse-meta">
                        <span>
                          {`${info.directories} directories found`}
                          {searchTerm && ` (filtered by "${searchTerm}")`}
                        </span>
                      </Card.Meta>

                      {/* Search input for directories */}
                      <div className="directory-search">
                        <Input
                          fluid
                          icon="search"
                          onChange={this.handleSearchChange}
                          placeholder="Search directories..."
                          value={searchTerm}
                        />
                      </div>

                      <Segment className="browse-folderlist">
                        <VirtualDirectoryTree
                          onSelect={(_, value) => this.selectDirectory(value)}
                          selectedDirectoryName={name}
                          tree={tree}
                        />
                      </Segment>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="pagination-container">
                          <Pagination
                            activePage={currentPage}
                            onPageChange={this.handlePageChange}
                            size="small"
                            totalPages={totalPages}
                          />
                          <div className="pagination-info">
                            Page {currentPage} of {totalPages} ({totalCount}{' '}
                            total)
                          </div>
                        </div>
                      )}
                    </Card.Content>
                  </Card>
                )}

                {name && (
                  <Directory
                    files={files}
                    locked={locked}
                    marginTop={-20}
                    name={name}
                    onClose={this.handleDeselectDirectory}
                    username={username}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default withRouter(EnhancedBrowse);
