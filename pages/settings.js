export default function SettingsRedirect() {
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
