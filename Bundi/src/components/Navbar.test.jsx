import React from 'react';
import { render } from '@testing-library/react';
import Navbar from './Navbar';
import { AuthContext } from '../context/AuthContext';

const mockUser = {
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.png',
};

describe('Navbar', () => {
  it('renders user display name and avatar', () => {
    const { getByText, getByAltText } = render(
      <AuthContext.Provider value={{ currentUser: mockUser }}>
        <Navbar />
      </AuthContext.Provider>
    );
    expect(getByText('Test User')).toBeInTheDocument();
    expect(getByAltText('')).toBeInTheDocument();
  });
}); 