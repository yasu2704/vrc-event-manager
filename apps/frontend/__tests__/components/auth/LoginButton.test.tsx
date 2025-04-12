import { render, screen } from '@testing-library/react';
import LoginButton from '../../../components/auth/LoginButton';
import { describe, it, expect, vi } from 'vitest';
import { SessionProvider } from "next-auth/react";

// Vitestの仕様に合わせてモックを修正
vi.mock('next-auth/react', () => {
  return {
    useSession: () => ({ data: null, status: 'unauthenticated' }),
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }
});

describe('LoginButton', () => {
  it('Googleログインボタンが表示されること', () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    render(
      <SessionProvider>
        <LoginButton />
      </SessionProvider>
    );
    const buttonElement = screen.getByText(/Googleでログイン/i);
    expect(buttonElement).not.toBeNull();
  });
});
