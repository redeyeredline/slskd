/* eslint-disable promise/prefer-await-to-then */
import './Browse.css';
import * as users from '../../lib/users';
import PlaceholderSegment from '../Shared/PlaceholderSegment';
import Directory from './Directory';
import DirectoryTree from './DirectoryTree';
import * as lzString from 'lz-string';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Button, Card, Icon, Input, Loader, Segment } from 'semantic-ui-react';

const initialState = {
  browseError: undefined,
  browseState: 'idle',
  browseStatus: 0,
  info: {
    directories: 0,
    files: 0,
    lockedDirectories: 0,
    lockedFiles: 0,
  },
  interval: undefined,
  selectedDirectory: {},
  selectedFiles: [],
  separator: '\\',
  tree: [],
  username: '',
};

class Browse extends Component {
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

  browse = () => {
    const username = this.inputtext.inputRef.current.value;

    // Clear any existing interval before starting a new browse
    if (this.state.interval) {
      clearInterval(this.state.interval);
    }

    this.setState(
      { browseError: undefined, browseState: 'pending', username },
      () => {
        // Start status polling for this browse
        this.setState({
          interval: window.setInterval(this.fetchStatus, 500),
        });

        // Use the regular browse API for better efficiency
        users
          .browse({ username })
          .then((response) => {
            // Ensure we have valid response data
            if (!response || typeof response !== 'object') {
              throw new Error('Invalid response from server');
            }

            let { directories = [] } = response;
            let { lockedDirectories = [] } = response;

            // Ensure directories and lockedDirectories are arrays
            if (!Array.isArray(directories)) {
              directories = [];
            }

            if (!Array.isArray(lockedDirectories)) {
              lockedDirectories = [];
            }

            // we need to know the directory separator. assume it is \ to start
            let separator;

            const directoryCount = directories.length;
            const fileCount = directories.reduce((accumulator, directory) => {
              // examine each directory as we process it to see if it contains \ or /, and set separator accordingly
              if (!separator && directory && directory.name) {
                if (directory.name.includes('\\')) separator = '\\';
                else if (directory.name.includes('/')) separator = '/';
              }

              return accumulator + (directory?.fileCount || 0);
            }, 0);

            const lockedDirectoryCount = lockedDirectories.length;
            const lockedFileCount = lockedDirectories.reduce(
              (accumulator, directory) =>
                accumulator + (directory?.fileCount || 0),
              0,
            );

            directories = directories.concat(
              lockedDirectories.map((d) => ({ ...d, locked: true })),
            );

            // Build the directory tree
            const tree = this.getDirectoryTree({ directories, separator });

            this.setState({
              info: {
                directories: directoryCount,
                files: fileCount,
                lockedDirectories: lockedDirectoryCount,
                lockedFiles: lockedFileCount,
              },
              separator,
              tree,
            });
          })
          .then(() =>
            this.setState(
              { browseError: undefined, browseState: 'complete' },
              () => {
                this.saveState();
                // Stop the status polling since browse is complete
                if (this.state.interval) {
                  clearInterval(this.state.interval);
                  this.setState({ interval: undefined });
                }
              },
            ),
          )
          .catch((error) => {
            console.error('Browse failed:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to browse user';
            if (error.response?.status === 404) {
              errorMessage = 'User is offline or not found';
            } else if (
              error.code === 'ECONNABORTED' ||
              error.message?.includes('timeout')
            ) {
              errorMessage =
                'Browse request timed out - user may have too many files';
            } else if (error.response?.status >= 500) {
              errorMessage = 'Server error occurred while browsing';
            } else if (error.message) {
              errorMessage = error.message;
            }

            this.setState(
              {
                browseError: { message: errorMessage, originalError: error },
                browseState: 'error',
              },
              () => {
                // Stop the status polling since browse failed
                if (this.state.interval) {
                  clearInterval(this.state.interval);
                  this.setState({ interval: undefined });
                }
              },
            );
          });
      },
    );
  };

  clear = () => {
    this.setState(initialState, () => {
      this.saveState();
      this.inputtext.focus();
    });
  };

  handleRetryBrowse = () => {
    this.setState({ browseError: undefined }, () => {
      this.browse();
    });
  };

  keyUp = (event) => (event.key === 'Escape' ? this.clear() : '');

  saveState = () => {
    this.inputtext.inputRef.current.value = this.state.username;
    this.inputtext.inputRef.current.disabled =
      this.state.browseState !== 'idle';

    const storeToLocalStorage = () => {
      try {
        localStorage.setItem(
          'soulseek-example-browse-state',
          lzString.compress(JSON.stringify(this.state)),
        );
      } catch (error) {
        console.error(error);
      }
    };

    // Shifting the compression and safe out of the current render loop to speed up responsiveness
    // requestIdleCallback is not supported in Safari hence we push to next tick using Promise.resolve
    if (window.requestIdleCallback) {
      window.requestIdleCallback(storeToLocalStorage);
    } else {
      Promise.resolve().then(storeToLocalStorage);
    }
  };

  loadState = () => {
    this.setState(
      (!this.props.location.state?.user &&
        JSON.parse(
          lzString.decompress(
            localStorage.getItem('soulseek-example-browse-state') || '',
          ),
        )) ||
        initialState,
    );
  };

  fetchStatus = () => {
    const { browseState, username } = this.state;
    if (browseState === 'pending' && username) {
      users
        .getBrowseStatus({ username })
        .then((response) => {
          this.setState({
            browseStatus: response.data,
          });
        })
        .catch((error) => {
          // If we get a 404, the browse is likely complete or the user is offline
          // Don't spam the console with these errors
          if (error.response?.status !== 404) {
            console.error('Browse status check failed:', error);
          }
        });
    }
  };

  getDirectoryTree = ({ directories, separator }) => {
    // Safety checks for directories array
    if (!Array.isArray(directories) || directories.length === 0) {
      return [];
    }

    // Filter out any invalid directory objects
    const validDirectories = directories.filter(
      (d) => d && d.name && typeof d.name === 'string',
    );

    if (validDirectories.length === 0) {
      return [];
    }

    // Sort directories by name for consistent ordering
    validDirectories.sort((a, b) => a.name.localeCompare(b.name));

    // For very large datasets, use a more efficient approach
    if (validDirectories.length > 5_000) {
      return this.buildTreeEfficient(validDirectories, separator);
    }

    // Optimise this process so we only:
    // - loop through all directories once
    // - do the split once
    // - future look ups are done from the Map
    const depthMap = new Map();
    for (const d of validDirectories) {
      if (!d.name || !separator) continue;

      const directoryDepth = d.name.split(separator).length;
      if (!depthMap.has(directoryDepth)) {
        depthMap.set(directoryDepth, []);
      }

      depthMap.get(directoryDepth).push(d);
    }

    if (depthMap.size === 0) {
      return [];
    }

    const depth = Math.min(...Array.from(depthMap.keys()));
    const rootDirectories = depthMap.get(depth);

    if (!rootDirectories || rootDirectories.length === 0) {
      return [];
    }

    return rootDirectories.map((directory) =>
      this.getChildDirectories(depthMap, directory, separator, depth + 1),
    );
  };

  buildTreeEfficient = (directories, separator) => {
    // Create a map for O(1) lookups
    const directoryMap = new Map();
    const rootDirectories = [];

    // First pass: create map and identify root directories
    for (const directory of directories) {
      directoryMap.set(directory.name, { ...directory, children: [] });

      const parts = directory.name.split(separator);
      if (parts.length === 1) {
        rootDirectories.push(directoryMap.get(directory.name));
      }
    }

    // Second pass: build parent-child relationships
    for (const directory of directories) {
      const parts = directory.name.split(separator);
      if (parts.length > 1) {
        const parentName = parts.slice(0, -1).join(separator);
        const parent = directoryMap.get(parentName);
        if (parent) {
          parent.children.push(directoryMap.get(directory.name));
        }
      }
    }

    // Sort root directories and children for consistent ordering
    rootDirectories.sort((a, b) => a.name.localeCompare(b.name));

    // Sort children of each directory
    for (const directory of rootDirectories) {
      if (directory.children && directory.children.length > 0) {
        directory.children.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return rootDirectories;
  };

  getChildDirectories = (depthMap, root, separator, depth) => {
    // Safety checks for root object
    if (!root || !root.name || !separator) {
      return { ...root, children: [] };
    }

    if (!depthMap.has(depth)) {
      return { ...root, children: [] };
    }

    const children = depthMap
      .get(depth)
      .filter((d) => d && d.name && d.name.startsWith(root.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...root,
      children: children.map((c) =>
        this.getChildDirectories(depthMap, c, separator, depth + 1),
      ),
    };
  };

  selectDirectory = (directory) => {
    // Check if the directory has children (subdirectories)
    const hasChildren = directory.children && directory.children.length > 0;

    if (hasChildren) {
      // If directory has children, display them as subdirectories
      console.log('Directory children (raw):', directory.children);
      for (const child of directory.children) {
        console.log(
          'Child:',
          child.name,
          'fileCount:',
          child.fileCount,
          'directoryCount:',
          child.directoryCount,
        );
      }

      const subdirectories = directory.children.map((child) => {
        const name = child.name.split('\\').pop().split('/').pop();
        console.log('Constructing subdir:', {
          fileCount: child.fileCount,
          fullPath: child.name,
          name,
        });
        return {
          fileCount: child.fileCount,
          fullPath: child.name,
          name,
        };
      });
      console.log('Constructed subdirectories:', subdirectories);

      this.setState(
        {
          selectedDirectory: {
            ...directory,
            children: [],
            files: [],
            subdirectories,
          },
        },
        () => {
          this.saveState();
        },
      );
    } else {
      // If no children, fetch directory contents from API
      this.setState(
        { selectedDirectory: { ...directory, children: [] } },
        () => {
          this.saveState();
          this.fetchDirectoryContents(directory.name);
        },
      );
    }
  };

  fetchDirectoryContents = async (directoryPath) => {
    const { username } = this.state;
    if (!username || !directoryPath) return;

    try {
      const response = await users.getDirectoryContents({
        directory: directoryPath,
        username,
      });

      if (response) {
        this.setState((previousState) => ({
          selectedDirectory: {
            ...previousState.selectedDirectory,
            files: response.files || [],
            subdirectories: response.directories || [],
          },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch directory contents:', error);
    }
  };

  handleSelectSubdirectory = (subdirectory) => {
    // Navigate to the subdirectory using the full path
    const fullPath =
      subdirectory.fullPath ||
      `${this.state.selectedDirectory.name}${this.state.separator}${subdirectory.name}`;
    this.fetchDirectoryContents(fullPath);
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
      info,
      selectedDirectory,
      separator,
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
                ? { icon: 'search', onClick: this.browse }
                : { color: 'red', icon: 'x', onClick: this.clear })
            }
            className="search-input"
            disabled={pending}
            input={
              <input
                data-lpignore="true"
                placeholder="Username"
                type="search"
              />
            }
            loading={pending}
            onKeyUp={(event) => (event.key === 'Enter' ? this.browse() : '')}
            placeholder="Username"
            ref={(input) => (this.inputtext = input)}
            size="big"
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
              <div className="browse-error">
                <Icon
                  color="red"
                  name="warning circle"
                />
                <span>
                  {browseError.message || `Failed to browse ${username}`}
                </span>
                {browseError.originalError && (
                  <div
                    style={{
                      color: '#666',
                      fontSize: '0.9em',
                      marginTop: '0.5em',
                    }}
                  >
                    Try browsing a different user or check if the user is
                    online.
                  </div>
                )}
                <Button
                  onClick={this.handleRetryBrowse}
                  primary
                  size="small"
                  style={{ marginTop: '10px' }}
                >
                  <Icon name="refresh" />
                  Retry Browse
                </Button>
              </div>
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
                          {`${info.files + info.lockedFiles} files in ${info.directories + info.lockedDirectories} directories (including ${info.lockedFiles} files in ${info.lockedDirectories} locked directories)`}{' '}
                          {/* eslint-disable-line max-len */}
                        </span>
                      </Card.Meta>
                      <Segment className="browse-folderlist">
                        <DirectoryTree
                          onSelect={(_, value) => this.selectDirectory(value)}
                          selectedDirectoryName={name}
                          tree={tree}
                        />
                      </Segment>
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
                    onSelectSubdirectory={this.handleSelectSubdirectory}
                    separator={separator}
                    subdirectories={selectedDirectory.subdirectories || []}
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

export default withRouter(Browse);
