export type Gender = 'male' | 'female' | 'non-binary' | 'other' | '';

export interface User {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  country?: string;
  bio?: string;
  avatarUri?: string;
  photoUrl?: string;
  isVerified?: boolean;
  isProfileComplete?: boolean;
}
