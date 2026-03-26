import * as users from '../../lib/users';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import { Icon, List, Loader } from 'semantic-ui-react';

// Flatten the tree structure for virtual scrolling with collapse support
const flattenTree = (
  tree,
  level = 0,
  path = '',
  collapsedPaths = new Set(),
) => {
  const items = [];

  // Sort the tree items alphabetically by display name
  const sortedTree = [...tree].sort((a, b) => {
    const aName = a.name.split('\\').pop().split('/').pop().toLowerCase();
    const bName = b.name.split('\\').pop().split('/').pop().toLowerCase();
    return aName.localeCompare(bName);
  });

  for (const item of sortedTree) {
    const currentPath = path ? `${path}\\${item.name}` : item.name;
    const isCollapsed = collapsedPaths.has(currentPath);

    items.push({
      ...item,
      displayName: item.name.split('\\').pop().split('/').pop(),
      hasChildren: item.hasChildren,
      isCollapsed,
      level,
      // Use the constructed path to match collapsedPaths keys
      loading: item.loading,
      path: currentPath,
    });

    // Only add children if the folder is not collapsed
    if (item.children && item.children.length > 0 && !isCollapsed) {
      items.push(
        ...flattenTree(item.children, level + 1, currentPath, collapsedPaths),
      );
    }
  }

  return items;
};

const DirectoryTreeItem = ({
  item,
  onLazyLoad,
  onSelect,
  onToggleCollapse,
  selectedDirectoryName,
  style,
}) => {
  const isSelected = item.name === selectedDirectoryName;
  const isLocked = item.locked === true;

  const handleClick = (event) => {
    // If this folder has children but they're not loaded yet, trigger lazy loading
    if (item.hasChildren && !item.childrenLoaded && !item.loading) {
      console.log('Triggering lazy load for:', item.name);
      onLazyLoad(item);
    }

    // Always call onSelect to select the directory
    onSelect(event, item);
  };

  const handleToggle = (event) => {
    event.stopPropagation();

    console.log('Toggle clicked:', {
      childrenLoaded: item.childrenLoaded,
      hasChildren: item.hasChildren,
      isCollapsed: item.isCollapsed,
      itemName: item.name,
      loading: item.loading,
    });

    // If children aren't loaded yet, load them first
    if (item.hasChildren && !item.childrenLoaded && !item.loading) {
      console.log('Triggering lazy load for:', item.name);
      onLazyLoad(item);
      return;
    }

    // If children are loaded, toggle the collapsed state
    if (item.childrenLoaded && item.children && item.children.length > 0) {
      onToggleCollapse(item.path);
    }
  };

  return (
    <div style={style}>
      <List.Item
        className={`browse-folderlist-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          paddingLeft: `${item.level * 20 + 10}px`,
          userSelect: 'none',
        }}
      >
        <List.Icon
          className={`browse-folderlist-icon ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
          name={isLocked ? 'lock' : isSelected ? 'folder open' : 'folder'}
        />
        <List.Content>
          <List.Header
            className={`browse-folderlist-header ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
            style={{
              alignItems: 'center',
              display: 'flex',
              fontSize: '14px',
              fontWeight: isSelected ? 'bold' : 'normal',
              gap: '8px',
              opacity: isLocked ? 0.7 : 1,
            }}
          >
            {item.hasChildren && (
              <span style={{ alignItems: 'center', display: 'flex' }}>
                {item.childrenLoaded &&
                item.children &&
                item.children.length > 0 ? (
                  // Only show chevron if children are actually loaded AND there are children
                  <Icon
                    name={item.isCollapsed ? 'chevron right' : 'chevron down'}
                    onClick={handleToggle}
                    size="small"
                    style={{
                      color: '#666',
                      cursor: 'pointer',
                      marginRight: '4px',
                    }}
                  />
                ) : (
                  // Show a plus icon for unloaded folders or folders with no children
                  <Icon
                    name="plus"
                    onClick={handleToggle}
                    size="small"
                    style={{
                      color: '#666',
                      cursor: 'pointer',
                      marginRight: '4px',
                    }}
                  />
                )}
                {item.loading && (
                  <Loader
                    active
                    inline
                    size="tiny"
                  />
                )}
              </span>
            )}
            <span>{item.displayName}</span>
          </List.Header>
        </List.Content>
      </List.Item>
    </div>
  );
};

// Recursively filter the tree for a search term, preserving parent paths for matches
export function filterTree(tree, filter) {
  if (!filter || !filter.trim()) return tree;
  const term = filter.trim().toLowerCase();
  function filterNode(node) {
    const name = (node.name || '').toLowerCase();
    const children = node.children || [];
    const filteredChildren = children.map(filterNode).filter(Boolean);
    // Check if any file in this folder matches
    const files = node.files || [];
    const fileMatch = files.some((f) =>
      (f.filename || f.name || '').toLowerCase().includes(term),
    );
    if (name.includes(term) || fileMatch || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  }

  return tree.map(filterNode).filter(Boolean);
}

const DirectoryTree = React.forwardRef(
  ({ filter = '', onSelect, selectedDirectoryName, tree, username }, ref) => {
    const [listHeight, setListHeight] = useState(500);
    const [collapsedPaths, setCollapsedPaths] = useState(new Set());
    const [controlBarHeight, setControlBarHeight] = useState(0);
    const [treeState, setTreeState] = useState(tree);
    const [previousCollapsedPaths, setPreviousCollapsedPaths] = useState(
      new Set(),
    );
    const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      triggerLazyLoad: (directory) => {
        console.log('Triggering lazy load for directory:', directory.name);
        handleLazyLoad(directory);
      },
    }));

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      triggerLazyLoad: (directory) => {
        console.log('Triggering lazy load for directory:', directory.name);
        handleLazyLoad(directory);
      },
    }));

    // Helper to update a node in the tree by path
    const updateNodeByPath = useCallback((treeData, path, updater) => {
      return treeData.map((node) => {
        if (node.name === path) {
          return updater(node);
        }

        if (node.children) {
          return {
            ...node,
            children: updateNodeByPath(node.children, path, updater),
          };
        }

        return node;
      });
    }, []);

    // Lazy load children when a folder is expanded
    const handleLazyLoad = useCallback(
      async (item) => {
        console.log('Lazy loading for item:', item);
        console.log('Username:', username);
        console.log('Parent path:', item.name);

        setTreeState((previousTree) =>
          updateNodeByPath(previousTree, item.name, (node) => ({
            ...node,
            loading: true,
          })),
        );
        try {
          const response = await users.getDirectoryChildren({
            parent: item.name,
            username,
          });
          console.log('Directory children response:', response);

          if (response && response.subdirectories) {
            setTreeState((previousTree) =>
              updateNodeByPath(previousTree, item.name, (node) => ({
                ...node,
                children: response.subdirectories.map((d) => ({
                  ...d,
                  // Assume all can have children for now
                  children: [],
                  childrenLoaded: false,
                  hasChildren: true,
                })),
                childrenLoaded: true,
                loading: false,
              })),
            );
            // Auto-expand after loading
            setCollapsedPaths((previous) => {
              const newSet = new Set(previous);
              newSet.delete(item.name);
              return newSet;
            });
          } else {
            console.log('No subdirectories in response');
            setTreeState((previousTree) =>
              updateNodeByPath(previousTree, item.name, (node) => ({
                ...node,
                children: [],
                childrenLoaded: true,
                loading: false,
              })),
            );
            // Auto-expand after loading
            setCollapsedPaths((previous) => {
              const newSet = new Set(previous);
              newSet.delete(item.name);
              return newSet;
            });
          }
        } catch (error) {
          console.error('Error loading directory children:', error);
          setTreeState((previousTree) =>
            updateNodeByPath(previousTree, item.name, (node) => ({
              ...node,
              loading: false,
            })),
          );
        }
      },
      [updateNodeByPath, username],
    );

    // Get all folder paths that have children
    const allFolderPaths = useMemo(() => {
      const getPaths = (treeData) => {
        const paths = [];
        for (const item of treeData) {
          if (item.hasChildren) {
            paths.push(item.name); // Use original name
            if (item.children && item.children.length > 0) {
              paths.push(...getPaths(item.children));
            }
          }
        }

        return paths;
      };

      return getPaths(treeState || []);
    }, [treeState]);

    // Filter the tree if a filter is provided
    const filteredTree = useMemo(
      () => filterTree(treeState || [], filter),
      [filter, treeState],
    );
    // Flatten the filtered tree for virtual scrolling with collapse support
    const flattenedItems = useMemo(() => {
      return flattenTree(filteredTree, 0, '', collapsedPaths);
    }, [collapsedPaths, filteredTree]);

    // Toggle collapse state for a folder
    const handleToggleCollapse = (path) => {
      setCollapsedPaths((previous) => {
        const newSet = new Set(previous);
        if (newSet.has(path)) {
          newSet.delete(path);
        } else {
          newSet.add(path);
        }

        return newSet;
      });
    };

    // Helper to get all expandable paths in the tree
    const getAllExpandablePaths = useCallback((treeData) => {
      let paths = [];
      for (const node of treeData) {
        if (node.hasChildren) {
          paths.push(node.name);
          if (node.children && node.children.length > 0) {
            paths = paths.concat(getAllExpandablePaths(node.children));
          }
        }
      }

      return paths;
    }, []);

    // On initial tree load, expand the first folder and its first child only once
    useEffect(() => {
      if (treeState && treeState.length > 0 && !hasAutoExpanded) {
        const pathsToExpand = [];
        const firstRoot = treeState[0];
        if (firstRoot) {
          pathsToExpand.push(firstRoot.name);
          if (firstRoot.children && firstRoot.children.length > 0) {
            pathsToExpand.push(firstRoot.children[0].name);
          }
        }

        setCollapsedPaths((previous) => {
          const newSet = new Set(previous);
          for (const path of pathsToExpand) newSet.delete(path);
          return newSet;
        });
        setHasAutoExpanded(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAutoExpanded, treeState]);

    // Collapse all folders
    const handleCollapseAll = () => {
      const allPaths = getAllExpandablePaths(treeState || []);
      setCollapsedPaths(new Set(allPaths));
      setHasAutoExpanded(true); // Prevent auto-expand after user action
    };

    // Expand all folders
    const handleExpandAll = () => {
      // Find all folders that have children but are not loaded
      const triggerLazyLoadForAll = (treeData) => {
        for (const node of treeData) {
          if (node.hasChildren && !node.childrenLoaded && !node.loading) {
            handleLazyLoad(node);
          }

          if (node.children && node.children.length > 0) {
            triggerLazyLoadForAll(node.children);
          }
        }
      };

      triggerLazyLoadForAll(treeState || []);
      setCollapsedPaths(new Set());
      setHasAutoExpanded(true); // Prevent auto-expand after user action
    };

    // Calculate item height (adjust based on your styling)
    const itemHeight = 22;

    // Render function for virtual list
    const renderItem = ({ index, style }) => {
      const item = flattenedItems[index];
      if (!item) return null;
      return (
        <DirectoryTreeItem
          item={item}
          onLazyLoad={handleLazyLoad}
          onSelect={onSelect}
          onToggleCollapse={handleToggleCollapse}
          selectedDirectoryName={selectedDirectoryName}
          style={style}
        />
      );
    };

    // Update list height when component mounts
    React.useEffect(() => {
      const updateHeight = () => {
        const container = document.querySelector('.browse-folderlist');
        if (container) {
          // Calculate available height more accurately
          const containerRect = container.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const containerTop = containerRect.top;
          const availableHeight = viewportHeight - containerTop - 100; // Leave space for bottom content
          const height = Math.min(container.clientHeight - 80, availableHeight);
          setListHeight(Math.max(height, 400)); // Ensure minimum height
        }
      };

      updateHeight();
      const timer = setTimeout(updateHeight, 50);
      const timer2 = setTimeout(updateHeight, 200);
      const timer3 = setTimeout(updateHeight, 500);
      window.addEventListener('resize', updateHeight);
      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
        clearTimeout(timer3);
        window.removeEventListener('resize', updateHeight);
      };
    }, [flattenedItems.length]);

    // When filter is active, auto-expand all root-level directories
    useEffect(() => {
      if (filter && filter.trim()) {
        // Save previous collapsed state
        setPreviousCollapsedPaths(new Set(collapsedPaths));
        // Expand all root-level directories
        const rootPaths = (treeState || []).map((item) => item.name);
        setCollapsedPaths((previous) => {
          const newSet = new Set(previous);
          for (const path of rootPaths) newSet.delete(path);
          return newSet;
        });
      } else {
        // Restore previous collapsed state when filter is cleared
        setCollapsedPaths(previousCollapsedPaths);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    // When the tree loads or changes, always expand the first root-level folder and its first child (if present)
    useEffect(() => {
      if (treeState && treeState.length > 0) {
        const pathsToExpand = [];
        // Always expand the first root-level folder
        const firstRoot = treeState[0];
        if (firstRoot) {
          pathsToExpand.push(firstRoot.name);
          // Also expand its first child if present
          if (firstRoot.children && firstRoot.children.length > 0) {
            pathsToExpand.push(firstRoot.children[0].name);
          }
        }

        setCollapsedPaths((previous) => {
          const newSet = new Set(previous);
          for (const path of pathsToExpand) newSet.delete(path);
          return newSet;
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeState]);

    if (!flattenedItems.length) {
      return (
        <div style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
          No directories found
        </div>
      );
    }

    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        {/* Collapse/Expand All Controls */}
        {allFolderPaths.length > 0 && (
          <div
            ref={(element) => {
              if (element) {
                setControlBarHeight(element.offsetHeight);
              }
            }}
            style={{
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0',
              borderRadius: '4px 4px 0 0',
              display: 'flex',
              fontSize: '12px',
              gap: '8px',
              marginBottom: '4px',
              padding: '8px 12px',
            }}
          >
            <button
              onBlur={(event) =>
                (event.target.style.backgroundColor = 'transparent')
              }
              onClick={handleCollapseAll}
              onFocus={(event) =>
                (event.target.style.backgroundColor = '#e9ecef')
              }
              onMouseOut={(event) =>
                (event.target.style.backgroundColor = 'transparent')
              }
              onMouseOver={(event) =>
                (event.target.style.backgroundColor = '#e9ecef')
              }
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
              }}
              type="button"
            >
              Collapse All
            </button>
            <button
              onBlur={(event) =>
                (event.target.style.backgroundColor = 'transparent')
              }
              onClick={handleExpandAll}
              onFocus={(event) =>
                (event.target.style.backgroundColor = '#e9ecef')
              }
              onMouseOut={(event) =>
                (event.target.style.backgroundColor = 'transparent')
              }
              onMouseOver={(event) =>
                (event.target.style.backgroundColor = '#e9ecef')
              }
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
              }}
              type="button"
            >
              Expand All
            </button>
            <span style={{ color: '#999', marginLeft: 'auto' }}>
              {flattenedItems.length} items
            </span>
          </div>
        )}
        <div
          style={{
            height:
              allFolderPaths.length > 0
                ? Math.max(listHeight - controlBarHeight, 400)
                : Math.max(listHeight, 400),
          }}
        >
          <VirtualList
            height={
              allFolderPaths.length > 0
                ? Math.max(listHeight - controlBarHeight, 400)
                : Math.max(listHeight, 400)
            }
            itemCount={flattenedItems.length}
            itemSize={itemHeight}
            overscanCount={10}
            width="100%"
          >
            {renderItem}
          </VirtualList>
        </div>
      </div>
    );
  },
);

DirectoryTree.displayName = 'DirectoryTree';

export default DirectoryTree;
