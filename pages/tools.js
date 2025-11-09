export default function ToolsRedirect() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/app',
      permanent: false,
    },
  };
}
