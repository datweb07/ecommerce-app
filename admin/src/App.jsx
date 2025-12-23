import { Routes, Route, Navigate } from "react-router";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "@clerk/clerk-react";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import CustomersPage from "./pages/CustomersPage";
import DashboardLayout from "./layouts/DashboardLayout";
import PageLoader from "./components/PageLoader";

function App() {
  const { isSignedIn, isLoaded } = useAuth();


  // loading page
  if (!isLoaded) return <PageLoader />;

  
  return (
    <div>
      <Routes>
        <Route
          path="/login"
          element={isSignedIn ? <Navigate to={"/dashboard"} /> : <LoginPage />}
        />

        <Route
          path="/"
          element={
            isSignedIn ? <DashboardLayout /> : <Navigate to={"/login"} />
          }
        >
          <Route index element={<Navigate to={"dashboard"} />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="customers" element={<CustomersPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
