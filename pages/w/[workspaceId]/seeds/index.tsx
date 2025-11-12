import * as React from "react";
import type { NextPage } from "next";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { withAuth } from "../../../../lib/authGuard";
import { getWorkspaceContext } from "../../../../lib/workspaces";
import { getSeedsForWorkspace } from "../../../../lib/seeds";
import { getSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import type { WorkspaceWithRole } from "../../../../lib/workspaces";
import type { Seed } from "../../../../types/db";
import Link from "next/link";
import { useRouter } from "next/router";
import { CopilotPanel } from "../../../../src/components/copilot/CopilotPanel";

type SeedsPageProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seeds: Seed[];
};

const SeedsPage: NextPage<SeedsPageProps> = ({ workspace, workspaces, seeds }) => {
  const router = useRouter();
  const workspaceId = workspace.id;
  const [showIdeaBuilder, setShowIdeaBuilder] = React.useState(false);

  const handleSeedCreated = async (newSeedId: string) => {
    setShowIdeaBuilder(false);
    await router.push(`/w/${workspaceId}/seeds/${newSeedId}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2} mb={4}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">Seeds</Typography>
        <Typography color="text.secondary">
          Seeds capture the ideas, goals, or hypotheses this workspace is actively tending to.
        </Typography>
      </Stack>

      <Box mb={3} display="flex" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" onClick={() => router.push(`/w/${workspaceId}/dashboard`)}>
          Back to dashboard
        </Button>
        <Button variant="contained" onClick={() => setShowIdeaBuilder((prev) => !prev)}>
          {showIdeaBuilder ? "Hide idea builder" : "Start a new idea"}
        </Button>
      </Box>

      {showIdeaBuilder && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Idea builder
            </Typography>
            <CopilotPanel
              workspaceId={workspaceId}
              allowSeedCreation
              lensDefault="explore"
              modeDefault="ask"
              onSeedCreated={handleSeedCreated}
            />
          </CardContent>
        </Card>
      )}

      {seeds.length === 0 ? (
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
          }}
        >
          <Typography variant="h6">No seeds yet</Typography>
          <Typography color="text.secondary">
            Start by describing an idea above - Copilot will propose the first seed.
          </Typography>
        </Box>
      ) : (
        <List>
          {seeds.map((seed) => (
            <ListItem
              key={seed.id}
              divider
              component={Link}
              href={`/w/${workspaceId}/seeds/${seed.id}`}
              sx={{
                borderRadius: 1,
                mb: 1,
                "&:hover": { backgroundColor: "action.hover" },
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={600}>{seed.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {seed.status}
                    </Typography>
                  </Stack>
                }
                secondary={
                  seed.summary ||
                  `Updated ${new Date(seed.updated_at ?? seed.created_at).toLocaleString()}`
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  );
};

export const getServerSideProps = withAuth(async (ctx) => {
  const workspaceId = ctx.params?.workspaceId;

  if (typeof workspaceId !== "string") {
    return {
      redirect: {
        destination: "/app",
        permanent: false,
      },
    };
  }

  const serviceRole = getSupabaseServiceRoleClient();
  const { workspace, workspaces } = await getWorkspaceContext(
    ctx.supabase,
    ctx.user.id,
    workspaceId,
    { fallbackClient: serviceRole },
  );

  if (!workspace) {
    return { notFound: true };
  }

  const seeds = await getSeedsForWorkspace(ctx.supabase, workspaceId, ctx.user.id, {
    fallbackClient: serviceRole,
  });

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
      seeds,
    },
  };
});

export default SeedsPage;
