import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Profile } from './Profile';

const usersApiMock = vi.hoisted(() => ({
  changePassword: vi.fn(),
  currentUser: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../../services/usersApi', () => ({ usersApi: usersApiMock }));

const currentUser = {
  user_id: 7,
  username: 'nadia@example.com',
  name: 'Nadia',
  last_name: 'Diaz',
  group_id: 0,
  group_name: 'Administrators',
};

describe('Profile', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    usersApiMock.changePassword.mockReset();
    usersApiMock.currentUser.mockReset();
    usersApiMock.updateProfile.mockReset();
    usersApiMock.currentUser.mockResolvedValue({ data: currentUser });
    usersApiMock.updateProfile.mockResolvedValue({ data: { success: true } });
    usersApiMock.changePassword.mockResolvedValue({ data: { success: true } });
  });

  it('loads the signed-in user profile', async () => {
    render(<Profile />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('nadia@example.com')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Nadia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Diaz')).toBeInTheDocument();
  });

  it('submits profile name changes through usersApi', async () => {
    render(<Profile />);

    await waitFor(() => expect(screen.getByText('nadia@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByDisplayValue('Nadia'), { target: { value: 'Nadia Maria' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(usersApiMock.updateProfile).toHaveBeenCalledWith({
        name: 'Nadia Maria',
        last_name: 'Diaz',
      })
    );
    expect(await screen.findByText(/profile updated successfully/i)).toBeInTheDocument();
  });

  it('validates password confirmation before calling the API', async () => {
    render(<Profile />);

    await waitFor(() => expect(screen.getByText('nadia@example.com')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'old-secret' } });
    fireEvent.change(screen.getByPlaceholderText(/enter new password/i), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByPlaceholderText(/confirm new password/i), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(usersApiMock.changePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/new passwords do not match/i)).toBeInTheDocument();
  });
});
