export type Gender = 'male' | 'female' | 'non-binary' | 'other' | '';

export interface User {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  username?: string;
  gender?: string;
  country?: string;
  bio?: string;
  dob?: string;       // ISO date: YYYY-MM-DD
  avatarUri?: string;
  avatarUrl?: string;
  photoUrl?: string;
  isVerified?: boolean;
  isProfileComplete?: boolean;
  profile?: {
    avatarUrl?: string;
    fullName?: string;
    [key: string]: any;
  };
}
