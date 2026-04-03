export interface User {
  id: number;
  username: string;
  password: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: number;
  email: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserInput {
  username: string;
  password: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: number;
  email: string;
  avatar?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}
