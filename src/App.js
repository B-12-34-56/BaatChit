import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import "./style.scss";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './utils/firebase';
import FriendRequests from './components/friends/FriendRequests';
import UserSearch from './components/friends/UserSearch';
import FriendList from './components/friends/FriendList';

function App() {
  const [user, loading] = useAuthState(auth);

  const ProtectedRoute = ({ children }) => {
    if (!user && !loading) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/">
          <Route
            index
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route path="register" element={<Register />} />
          <Route path="login" element={<Login />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route
            path="upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="friend-requests"
            element={
              <ProtectedRoute>
                <FriendRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="user-search"
            element={
              <ProtectedRoute>
                <UserSearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="friends"
            element={
              <ProtectedRoute>
                <FriendList />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;