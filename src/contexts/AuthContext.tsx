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

// Default HOD user
const defaultHOD: User = {
  id: 'hod001',
  name: 'HOD CSE',
  email: 'hodcse@gmail.com',
  role: 'hod',
  department: 'CSE',
  accessLevel: 'full',
  isActive: true,
  phone: '+91 98765 43210',
  rollNumber: 'HOD001',
  joiningDate: '2020-01-01',
  designation: 'Head of Department',
  gender: 'Male',
  year: '1',
  sem: '1',
  div: 'A'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure default HOD user is in Firestore on app start
    const ensureDefaultHOD = async () => {
      try {
        const existingUser = await userService.getUser(defaultHOD.id);
        if (!existingUser) {
          console.log('[AuthContext] Creating default HOD user in Firestore on app start:', defaultHOD.email);
          await userService.createUser({
            ...defaultHOD,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            loginCount: 0
          });
          console.log('[AuthContext] Default HOD user created successfully');
        } else {
          console.log('[AuthContext] Default HOD user already exists in Firestore');
        }
      } catch (error) {
        console.error('[AuthContext] Error ensuring default HOD user on app start:', error);
      }
    };
    
    ensureDefaultHOD();

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
      // First check if it's the default HOD user
      if (email === defaultHOD.email && password === 'hodcse2025@attendance') {
        console.log('[AuthContext] Default HOD login:', defaultHOD.email);
        
        // Check if user already exists in Firestore
        const existingHOD = await userService.getUser(defaultHOD.id);
        
        if (existingHOD) {
          console.log('[AuthContext] Updating existing HOD user:', defaultHOD.id);
          // Update existing user with new login info
          await userService.updateUser(defaultHOD.id, {
            lastLogin: new Date().toISOString(),
            loginCount: (existingHOD.loginCount || 0) + 1
          });
        } else {
          console.log('[AuthContext] Creating new HOD user in Firestore:', defaultHOD.id);
          // Create new user in Firestore
          await userService.createUser({
            ...defaultHOD,
            lastLogin: new Date().toISOString(),
            loginCount: 1,
            createdAt: new Date().toISOString()
          });
        }
        console.log('[AuthContext] HOD user data saved to Firestore successfully');
        setUser(defaultHOD);
        localStorage.setItem('dypsn_user', JSON.stringify(defaultHOD));
        return;
      }

      // Run student and teacher validation in parallel using Promise.all - much faster!
      console.log('[AuthContext] Running parallel validation for student and teacher...');
      
      const [studentResult, teacherResult] = await Promise.all([
        userService.validateStudentCredentials(email, password).catch(error => {
          console.log('[AuthContext] Student validation error:', error.message);
          return null;
        }),
        userService.validateTeacherCredentials(email, password).catch(error => {
          console.log('[AuthContext] Teacher validation error:', error.message);
          return null;
        })
      ]);

      // Check student login result
      if (studentResult) {
        console.log('[AuthContext] Student login with phone number:', studentResult.email);
        await userService.updateUser(studentResult.id, {
          lastLogin: new Date().toISOString(),
          loginCount: (studentResult.loginCount || 0) + 1
        });
        setUser(studentResult);
        localStorage.setItem('dypsn_user', JSON.stringify(studentResult));
        return;
      }

      // Check teacher login result
      if (teacherResult) {
        console.log('[AuthContext] Teacher login successful:', teacherResult.email);
        await userService.updateUser(teacherResult.id, {
          lastLogin: new Date().toISOString(),
          loginCount: (teacherResult.loginCount || 0) + 1
        });
        setUser(teacherResult);
        localStorage.setItem('dypsn_user', JSON.stringify(teacherResult));
        return;
      } else {
        console.log('[AuthContext] Teacher validation returned null for:', email);
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
    console.log('[AuthContext] Ensuring default HOD user is in Firestore...');
    try {
      const existingUser = await userService.getUser(defaultHOD.id);
      if (!existingUser) {
        console.log('[AuthContext] Creating default HOD user in Firestore:', defaultHOD.email);
        await userService.createUser({
          ...defaultHOD,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          loginCount: 0
        });
        console.log('[AuthContext] Default HOD user created successfully');
      } else {
        console.log('[AuthContext] Default HOD user already exists in Firestore');
      }
    } catch (error) {
      console.error('[AuthContext] Error ensuring default HOD user in Firestore:', error);
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