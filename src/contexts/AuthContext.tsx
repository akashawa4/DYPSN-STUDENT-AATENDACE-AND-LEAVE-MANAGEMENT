import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { userService } from '../firebase/firestore';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  ensureDemoUsersInFirestore: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: User[] = [
  {
    id: 'student001',
    name: 'Demo Student',
    email: 'student.demo@dypsn.edu',
    role: 'student',
    department: 'CSE',
    accessLevel: 'basic',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00001',
    rollNumber: 'STU001',
    year: '2',
    sem: '3',
    div: 'A',
    joiningDate: '2022-08-01',
    designation: 'Student',
    gender: 'Male'
  },
  {
    id: 'student002',
    name: 'Demo Student 2',
    email: 'student2.demo@dypsn.edu',
    role: 'student',
    department: 'CSE',
    accessLevel: 'basic',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00002',
    rollNumber: 'STU002',
    year: '2',
    sem: '3',
    div: 'A',
    joiningDate: '2022-08-01',
    designation: 'Student',
    gender: 'Female'
  },
  {
    id: 'student003',
    name: 'Demo Student 3',
    email: 'student3.demo@dypsn.edu',
    role: 'student',
    department: 'CSE',
    accessLevel: 'basic',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00003',
    rollNumber: 'STU003',
    year: '3',
    sem: '5',
    div: 'B',
    joiningDate: '2021-08-01',
    designation: 'Student',
    gender: 'Male'
  },
  {
    id: 'student004',
    name: 'Demo Student 4',
    email: 'student4.demo@dypsn.edu',
    role: 'student',
    department: 'CSE',
    accessLevel: 'basic',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00004',
    rollNumber: 'STU004',
    year: '4',
    sem: '7',
    div: 'A',
    joiningDate: '2020-08-01',
    designation: 'Student',
    gender: 'Female'
  },
  {
    id: 'teacher001',
    name: 'Demo Teacher',
    email: 'teacher.demo@dypsn.edu',
    role: 'teacher',
    department: 'CSE',
    accessLevel: 'approver',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/936126/pexels-photo-936126.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00005',
    rollNumber: 'TCH001',
    joiningDate: '2020-01-15',
    designation: 'Assistant Professor',
    gender: 'Female'
  },
  {
    id: 'hod001',
    name: 'Demo HOD',
    email: 'hod.demo@dypsn.edu',
    role: 'hod',
    department: 'CSE',
    accessLevel: 'full',
    isActive: true,
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
    phone: '+91 90000 00006',
    rollNumber: 'HOD001',
    joiningDate: '2018-06-01',
    designation: 'Head of Department',
    gender: 'Male'
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure all demo users are in Firestore on app start
    const ensureDemoUsers = async () => {
      try {
        for (const demoUser of mockUsers) {
          const existingUser = await userService.getUser(demoUser.id);
          if (!existingUser) {
            console.log('[AuthContext] Creating demo user in Firestore on app start:', demoUser.email);
            await userService.createUser({
              ...demoUser,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              loginCount: 0
            });
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error ensuring demo users on app start:', error);
      }
    };
    
    ensureDemoUsers();

    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in with Firebase
        try {
          // Try to get user data from Firestore
          const userData = await userService.getUser(firebaseUser.uid);
          
          if (userData) {
            setUser(userData);
            localStorage.setItem('dypsn_user', JSON.stringify(userData));
          } else {
            // Create basic user data for Firebase user
            const basicUserData: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'student', // Default role
              department: 'Computer Science',
              accessLevel: 'basic',
              isActive: true,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              loginCount: 1
            };
            
            // Save to Firestore
            await userService.createUser(basicUserData);
            setUser(basicUserData);
            localStorage.setItem('dypsn_user', JSON.stringify(basicUserData));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        // Check for stored demo user
        const storedUser = localStorage.getItem('dypsn_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // First check if it's a demo user
      const foundDemoUser = mockUsers.find(u => u.email === email);
      if (foundDemoUser) {
        // Demo user login
        console.log('[AuthContext] Demo user login:', foundDemoUser.email);
        
        // Check if user already exists in Firestore
        const existingDemoUser = await userService.getUser(foundDemoUser.id);
        
        if (existingDemoUser) {
          console.log('[AuthContext] Updating existing user:', foundDemoUser.id);
          // Update existing user with new login info
          await userService.updateUser(foundDemoUser.id, {
            lastLogin: new Date().toISOString(),
            loginCount: (existingDemoUser.loginCount || 0) + 1
          });
        } else {
          console.log('[AuthContext] Creating new user in Firestore:', foundDemoUser.id);
          // Create new user in Firestore
          await userService.createUser({
            ...foundDemoUser,
            lastLogin: new Date().toISOString(),
            loginCount: 1,
            createdAt: new Date().toISOString()
          });
        }
        console.log('[AuthContext] User data saved to Firestore successfully');
        setUser(foundDemoUser);
        localStorage.setItem('dypsn_user', JSON.stringify(foundDemoUser));
        return;
      }

      // Check student login (email + phone as password)
      const student = await userService.validateStudentCredentials(email, password);
      if (student) {
        console.log('[AuthContext] Student login with phone number:', student.email);
        await userService.updateUser(student.id, {
          lastLogin: new Date().toISOString(),
          loginCount: (student.loginCount || 0) + 1
        });
        setUser(student);
        localStorage.setItem('dypsn_user', JSON.stringify(student));
        return;
      }

      // Check teacher login (email + phone as password)
      const teacher = await userService.validateTeacherCredentials(email, password);
      if (teacher) {
        console.log('[AuthContext] Teacher login with phone number:', teacher.email);
        await userService.updateUser(teacher.id, {
          lastLogin: new Date().toISOString(),
          loginCount: (teacher.loginCount || 0) + 1
        });
        setUser(teacher);
        localStorage.setItem('dypsn_user', JSON.stringify(teacher));
        return;
      }

      // Try regular Firebase authentication for teachers/HODs
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // User data will be handled by the auth state listener
        console.log('[AuthContext] Firebase authentication successful');
      } catch (firebaseError: any) {
        // If Firebase auth fails, check if user exists in our database
        const existingUser = await userService.getUser(email);
        if (existingUser) {
          throw new Error('Invalid password. Please try again.');
        } else {
          throw new Error('User not found. Please check your email or contact administrator.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      // Create complete user data
      const completeUserData: User = {
        id: firebaseUser.uid,
        name: userData.name || firebaseUser.displayName || email.split('@')[0],
        email: email,
        role: userData.role || 'student',
        department: userData.department || 'Computer Science',
        accessLevel: userData.accessLevel || 'basic',
        isActive: true,
        phone: userData.phone,
        rollNumber: userData.rollNumber,
        joiningDate: userData.joiningDate,
        designation: userData.designation,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        loginCount: 1
      };
      // Save to Firestore
      await userService.createUser(completeUserData);
      setUser(completeUserData);
      localStorage.setItem('dypsn_user', JSON.stringify(completeUserData));
    } catch (error: any) {
      console.error('Error creating user account:', error);
      throw new Error(error.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
    }
    
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('dypsn_user');
  };

  const ensureDemoUsersInFirestore = async () => {
    console.log('[AuthContext] Ensuring all demo users are in Firestore...');
    try {
      for (const demoUser of mockUsers) {
        const existingUser = await userService.getUser(demoUser.id);
        if (!existingUser) {
          console.log('[AuthContext] Creating demo user in Firestore:', demoUser.email);
          await userService.createUser({
            ...demoUser,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            loginCount: 0
          });
        } else {
          console.log('[AuthContext] Demo user already exists in Firestore:', demoUser.email);
        }
      }
      console.log('[AuthContext] All demo users ensured in Firestore');
    } catch (error) {
      console.error('[AuthContext] Error ensuring demo users in Firestore:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, login, signUp, logout, isLoading, ensureDemoUsersInFirestore }}>
      {children}
    </AuthContext.Provider>
  );
};



export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};