import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarUploader from '../components/AvatarUploader';

const mocks = vi.hoisted(() => ({
  uploadProfilePicture: vi.fn(),
  deleteProfilePicture: vi.fn(),
}));

vi.mock('../../../services/api/usersApi', () => ({
  usersApi: {
    uploadProfilePicture: mocks.uploadProfilePicture,
    deleteProfilePicture: mocks.deleteProfilePicture,
    profilePictureUrl: (id: number) => `/api/users/${id}/profile-picture`,
  },
}));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const user = {
  id: 7,
  firstName: 'Jean',
  lastName: 'Dupont',
  profilePictureUrl: '/api/users/7/profile-picture?ticket=abc',
  updatedAt: null,
};

/** L'uploader vit dans le <form> de la fiche utilisateur (UserEdit). */
function mountInsideForm() {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  const view = render(
    <form onSubmit={onSubmit}>
      <AvatarUploader user={user} />
    </form>,
  );
  return { onSubmit, ...view };
}

describe('AvatarUploader dans le formulaire de la fiche utilisateur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadProfilePicture.mockResolvedValue({ ...user });
    mocks.deleteProfilePicture.mockResolvedValue({ ...user, profilePictureUrl: null });
  });

  it('whenClickingReplace_thenParentFormIsNotSubmitted', () => {
    const { onSubmit } = mountInsideForm();

    fireEvent.click(screen.getByRole('button', { name: /Remplacer/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('whenClickingRemove_thenParentFormIsNotSubmitted', async () => {
    const { onSubmit } = mountInsideForm();

    fireEvent.click(screen.getByRole('button', { name: /Retirer/ }));

    await waitFor(() => expect(mocks.deleteProfilePicture).toHaveBeenCalledWith(7));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('whenSelectingAnImage_thenItIsUploadedForTheUser', async () => {
    const { container } = mountInsideForm();
    const file = new File(['png'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => expect(mocks.uploadProfilePicture).toHaveBeenCalledWith(7, file));
  });
});
