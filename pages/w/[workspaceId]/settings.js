import * as React from 'react';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { requireAuthAndWorkspace } from '../../../lib/requireWorkspacePage';

export default function WorkspaceSettings({ workspace }) {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="overline" color="text.secondary">
          Admin · {workspace.name}
        </Typography>
        <Typography variant="h4">Settings</Typography>
        <Typography color="text.secondary">
          Begin wiring workspace preferences here. These controls are placeholders for future forms.
        </Typography>
      </Stack>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">Workspace Details</Typography>
          <TextField label="Workspace name" defaultValue={workspace.name} fullWidth />
          <TextField label="Team contact" placeholder="alerts@example.com" fullWidth />
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <Typography variant="h6">Notifications</Typography>
          <FormGroup>
            <FormControlLabel control={<Switch defaultChecked />} label="Enable weekly summaries" />
            <FormControlLabel control={<Switch />} label="Pause alert emails" />
          </FormGroup>
        </Stack>
        <Divider />
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" gap={2}>
          <Button variant="outlined">Reset</Button>
          <Button variant="contained">Save Changes</Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export const getServerSideProps = requireAuthAndWorkspace;
