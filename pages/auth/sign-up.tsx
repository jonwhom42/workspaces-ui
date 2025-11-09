import type { GetServerSideProps } from 'next';
import AuthView from '../../src/components/auth/AuthView';
import { getAuthenticatedUser } from '../../lib/auth';

const SignUpPage = () => {
  return <AuthView initialMode="signup" />;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await getAuthenticatedUser(ctx);

  if (auth?.user) {
    return {
      redirect: {
        destination: '/app',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default SignUpPage;
