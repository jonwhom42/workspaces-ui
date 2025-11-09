export default function ProfileRedirect() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/profile-settings',
      permanent: false,
    },
  };
}
