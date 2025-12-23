import { useNavigate } from "react-router";

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-base-900 via-base-800 to-base-900 flex items-center justify-center p-8"
      data-theme="abyss"
    >
      <div className="max-w-4xl w-full bg-base-100/5 backdrop-blur-sm rounded-2xl p-10 shadow-2xl shadow-base-900/50 flex flex-col lg:flex-row gap-8 items-center border border-base-300/10">
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2 text-white">
            Welcome to
            <span className="text-primary ml-2">ShopMaster</span>
          </h1>

          <p className="text-base-content/70 text-lg mb-8">
            Manage products, orders and customers with a simple, beautiful admin
            experience. Get started by signing in.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate("/login")}
              className="btn btn-primary btn-lg px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
            >
              Get Started
            </button>

            <button
              onClick={() => navigate("/login")}
              className="btn btn-outline btn-lg px-8 border-base-content/20 hover:border-base-content/40 hover:bg-base-100/10 transition-all duration-300"
            >
              Sign In
            </button>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-base-100/5 p-5 rounded-xl border border-base-300/10 hover:border-primary/20 transition-colors duration-300">
              <div className="text-primary text-2xl mb-2"></div>
              <h3 className="font-semibold text-white mb-2">
                Real-time Analytics
              </h3>
              <p className="text-sm text-base-content/60">
                Monitor your store performance in real-time
              </p>
            </div>

            <div className="bg-base-100/5 p-5 rounded-xl border border-base-300/10 hover:border-primary/20 transition-colors duration-300">
              <div className="text-primary text-2xl mb-2"></div>
              <h3 className="font-semibold text-white mb-2">
                Product Management
              </h3>
              <p className="text-sm text-base-content/60">
                Easily manage your inventory and products
              </p>
            </div>

            <div className="bg-base-100/5 p-5 rounded-xl border border-base-300/10 hover:border-primary/20 transition-colors duration-300">
              <div className="text-primary text-2xl mb-2"></div>
              <h3 className="font-semibold text-white mb-2">
                Customer Insights
              </h3>
              <p className="text-sm text-base-content/60">
                Understand your customers better
              </p>
            </div>
          </div>
        </div>

        <div className="lg:w-64 lg:h-64 w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/10 via-base-100/5 to-secondary/5 flex flex-col items-center justify-center text-center p-6 border border-primary/10 shadow-lg shadow-primary/5">
          <div className="text-5xl mb-4"></div>
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Admin
            <br />
            Dashboard
          </div>
          <div className="text-xs text-base-content/50 mt-4">
            Powered by ShopMaster
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
