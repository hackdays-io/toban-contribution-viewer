import { useContext } from 'react';
import AuthContext from './AuthContext';

// Hook to use the auth context
const useAuth = () => useContext(AuthContext);

export default useAuth;
