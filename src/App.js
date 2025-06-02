import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import "./style.scss";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import FriendRequests from './components/friends/FriendRequests';
import UserSearch from './components/friends/UserSearch';
import FriendList from './components/friends/FriendList';

function App() {
  const {currentUser} = useContext(AuthContext);

  const ProtectedRoute = ({children}) => {
    if(currentUser){
      return children;
    }
    return <Login />
  } 
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
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="upload" element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          } />
          <Route path="profile" element={<Profile />} />
          <Route path="friend-requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
          <Route path="user-search" element={<ProtectedRoute><UserSearch /></ProtectedRoute>} />
          <Route path="friends" element={<ProtectedRoute><FriendList /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
