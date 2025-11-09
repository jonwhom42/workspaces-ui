import * as React from 'react';
import { useRouter } from 'next/router';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { WorkspaceWithRole } from '../../lib/workspaces';

type MiniDrawerProps = {
  children: React.ReactNode;
};

const drawerWidth = 280;

const buildNavItems = (workspace: WorkspaceWithRole | null) => {
  if (!workspace) {
    return [];
  }
  return [
    { label: 'Dashboard', path: `/w/${workspace.id}/dashboard`, icon: DashboardOutlinedIcon },
    { label: 'Tools', path: `/w/${workspace.id}/tools`, icon: BuildOutlinedIcon },
    { label: 'Settings', path: `/w/${workspace.id}/settings`, icon: SettingsOutlinedIcon },
  ];
};

export default function MiniDrawer({ children }: MiniDrawerProps) {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { workspaces, currentWorkspace, loading, setWorkspace, refreshWorkspaces } = useWorkspace();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [workspaceMenuAnchor, setWorkspaceMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [createWorkspaceName, setCreateWorkspaceName] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const isIOS = React.useMemo(
    () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent),
    [],
  );

  const navItems = React.useMemo(() => buildNavItems(currentWorkspace), [currentWorkspace]);

  const handleDrawerToggle = React.useCallback(() => {
    if (isDesktop) {
      setDesktopOpen((prev) => !prev);
      return;
    }
    setMobileOpen((prev) => !prev);
  }, [isDesktop]);

  const closeMobileDrawer = React.useCallback(() => setMobileOpen(false), []);
  const openMobileDrawer = React.useCallback(() => setMobileOpen(true), []);

  const avatarLabel = user?.email ? user.email.slice(0, 1).toUpperCase() : 'U';

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleWorkspaceMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setWorkspaceMenuAnchor(event.currentTarget);
  };

  const handleWorkspaceMenuClose = () => {
    setWorkspaceMenuAnchor(null);
  };

  const goToProfileSettings = () => {
    handleUserMenuClose();
    router.push('/profile-settings');
  };

  const handleSignOut = async () => {
    handleUserMenuClose();
    await supabase.auth.signOut();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/auth/sign-in');
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    handleWorkspaceMenuClose();
    setWorkspace(workspaceId);
  };

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createWorkspaceName.trim()) {
      setCreateError('Workspace name is required.');
      return;
    }
    setCreatingWorkspace(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createWorkspaceName.trim() }),
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to create workspace.');
      }
      const payload = await response.json();
      const nextWorkspaceId: string = payload.workspaceId;
      await refreshWorkspaces();
      setWorkspace(nextWorkspaceId);
      setCreateWorkspaceName('');
      setCreateDialogOpen(false);
    } catch (error: any) {
      setCreateError(error.message);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const drawerHeader = (
    <Toolbar sx={{ px: 3, flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography variant="overline" color="text.secondary">
        Workspace
      </Typography>
      <Typography
        variant="h6"
        component="div"
        sx={{ fontWeight: 600, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {currentWorkspace?.name ?? 'Select workspace'}
      </Typography>
      <Button
        size="small"
        sx={{ mt: 0.5, px: 0 }}
        onClick={() => setCreateDialogOpen(true)}
        color="primary"
      >
        + Create workspace
      </Button>
    </Toolbar>
  );

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {drawerHeader}
      <Divider />
      <List sx={{ flexGrow: 1, py: 1 }}>
        {loading && (
          <ListItem>
            <ListItemText primary="Loading workspaces..." />
          </ListItem>
        )}
        {!loading && navItems.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No workspace selected"
              secondary="Create or select a workspace to begin."
            />
          </ListItem>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = router.asPath.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => {
                  if (router.asPath !== item.path) {
                    router.push(item.path);
                  }
                  if (!isDesktop) {
                    closeMobileDrawer();
                  }
                }}
                selected={isActive}
                sx={{
                  mx: 1,
                  my: 0.5,
                  borderRadius: 1.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Use the navigation to explore each workspace view.
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          width: { md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { md: desktopOpen ? `${drawerWidth}px` : 0 },
          transition: (appTheme) =>
            appTheme.transitions.create(['width', 'margin'], {
              easing: appTheme.transitions.easing.sharp,
              duration: desktopOpen
                ? appTheme.transitions.duration.enteringScreen
                : appTheme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            color="inherit"
            aria-label="toggle navigation"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap component="div">
              {currentWorkspace?.name ?? 'Workspace'}
            </Typography>
            <Tooltip title="Switch workspace">
              <IconButton size="small" onClick={handleWorkspaceMenuOpen}>
                <KeyboardArrowDownIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {user ? (
            <>
              <Tooltip title="Account">
                <IconButton onClick={handleUserMenuOpen} size="small" sx={{ ml: 1 }}>
                  <Avatar sx={{ width: 36, height: 36 }}>{avatarLabel}</Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  elevation: 6,
                  sx: {
                    mt: 1.5,
                    width: 300,
                    '& .MuiMenuItem-root': {
                      px: 2,
                      py: 1.25,
                    },
                  },
                }}
              >
                <Stack direction="row" spacing={2} sx={{ px: 2, pt: 1.5, pb: 2 }}>
                  <Avatar sx={{ width: 48, height: 48 }}>{avatarLabel}</Avatar>
                  <Box>
                    <Typography fontWeight={600}>
                      {user?.user_metadata?.full_name || 'Workspace member'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user?.email}
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ mb: 0.5 }} />
                <MenuItem onClick={goToProfileSettings}>
                  <ListItemIcon>
                    <ManageAccountsRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Profile settings
                </MenuItem>
                <MenuItem onClick={handleSignOut}>
                  <ListItemIcon>
                    <LogoutRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="outlined" size="small" onClick={() => router.push('/auth/sign-in')}>
              Sign in
            </Button>
          )}
          <Menu
            anchorEl={workspaceMenuAnchor}
            open={Boolean(workspaceMenuAnchor)}
            onClose={handleWorkspaceMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{
              sx: {
                minWidth: 280,
                p: 1,
              },
            }}
          >
            <MenuItem disabled divider>
              <Typography variant="subtitle2" color="text.secondary">
                Your workspaces
              </Typography>
            </MenuItem>
            {workspaces.length === 0 && (
              <MenuItem disabled sx={{ opacity: 0.8 }}>
                No workspaces yet
              </MenuItem>
            )}
            {workspaces.map((workspace) => (
              <MenuItem
                key={workspace.id}
                selected={workspace.id === currentWorkspace?.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                sx={{ borderRadius: 1 }}
              >
                <Stack spacing={0.25}>
                  <Typography fontWeight={600}>{workspace.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Role: {workspace.role}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
            <Divider sx={{ my: 1 }} />
            <MenuItem
              onClick={() => {
                handleWorkspaceMenuClose();
                setCreateDialogOpen(true);
              }}
            >
              + Create workspace
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{
          width: { md: desktopOpen ? drawerWidth : 0 },
          flexShrink: { md: 0 },
          transition: (navTheme) =>
            navTheme.transitions.create('width', {
              easing: navTheme.transitions.easing.sharp,
              duration: desktopOpen
                ? navTheme.transitions.duration.enteringScreen
                : navTheme.transitions.duration.leavingScreen,
            }),
        }}
        aria-label="primary navigation"
      >
        <SwipeableDrawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobileDrawer}
          onOpen={openMobileDrawer}
          disableBackdropTransition={!isIOS}
          disableDiscovery={isIOS}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawerContent}
        </SwipeableDrawer>
        <Drawer
          variant="persistent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          p: { xs: 2, sm: 4 },
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create workspace</DialogTitle>
        <form onSubmit={handleCreateWorkspace}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Workspace name"
              value={createWorkspaceName}
              onChange={(event) => setCreateWorkspaceName(event.target.value)}
              autoFocus
              fullWidth
              required
            />
            {createError && (
              <Typography variant="body2" color="error">
                {createError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={creatingWorkspace}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creatingWorkspace}>
              {creatingWorkspace ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
