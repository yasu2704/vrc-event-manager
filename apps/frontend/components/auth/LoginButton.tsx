"use client";

import { useSession, signIn, signOut } from 'next-auth/react';

const LoginButton: React.FC = () => {
  const { data: session } = useSession();

  if (session) {
    return (
      <>
        Signed in as {session.user?.email} <br />
        <button type="button" onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  return (
    <button type="button" onClick={() => signIn('google')}>Googleでログイン</button>
  );
};

export default LoginButton;
