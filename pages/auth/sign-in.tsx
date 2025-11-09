import type { GetServerSideProps } from 'next';
import AuthView from '../../src/components/auth/AuthView';
import { getAuthenticatedUser } from '../../lib/auth';

const SignInPage = () => {
  return <AuthView initialMode="signin" />;
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

export default SignInPage;
