import React, { useEffect, useState } from "react";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db } from "../../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { Wallet, Shield, RotateCcw, Calendar, Percent } from "lucide-react";

const auth = getAuth();

export default function FareManagement() {
  const primaryColor = "#364C6E";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [currentBaseFare, setCurrentBaseFare] = useState(0);
  const [currentDiscountPercentage, setCurrentDiscountPercentage] = useState(0);
  const [currentFareData, setCurrentFareData] = useState(null);
  
  const [newBaseFare, setNewBaseFare] = useState("");
  const [confirmBaseFare, setConfirmBaseFare] = useState("");
  const [newDiscountPercentage, setNewDiscountPercentage] = useState("");
  const [confirmDiscountPercentage, setConfirmDiscountPercentage] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [baseFareMatchError, setBaseFareMatchError] = useState(false);
  const [discountMatchError, setDiscountMatchError] = useState(false);
  const [newBaseFareError, setNewBaseFareError] = useState("");
  const [confirmBaseFareError, setConfirmBaseFareError] = useState("");
  const [newDiscountError, setNewDiscountError] = useState("");
  const [confirmDiscountError, setConfirmDiscountError] = useState("");
  
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("User");

  // Function to map user roles to display roles for logging
  const ROLE_MAPPING = {
    Admin: "System Admin",
    Super: "Super Admin",
  };

  const mapRoleForLogging = (role) => {
    return ROLE_MAPPING[role] || null;
  };

  // Function to log system activities with mapped role
  const logSystemActivity = async (activity, performedBy, role = null) => {
    try {
      const actualRole = role || userRole;
      const displayRole = mapRoleForLogging(actualRole);

      await addDoc(collection(db, "systemLogs"), {
        activity,
        performedBy,
        role: displayRole,
        timestamp: serverTimestamp(),
      });
      console.log("System activity logged successfully");
    } catch (error) {
      console.error("Error logging system activity:", error);
    }
  };

  // Fetch latest fare document from 'fares' collection
  useEffect(() => {
    const fetchFare = async () => {
      try {
        const q = query(
          collection(db, "fares"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          setCurrentBaseFare(parseFloat(data.basePrice) || 0);
          setCurrentDiscountPercentage(parseFloat(data.discount) || 0);
          setCurrentFareData(data);
        } else {
          // If no fare data exists, set defaults
          setCurrentBaseFare(0);
          setCurrentDiscountPercentage(0);
        }
      } catch (e) {
        console.error("Error fetching fare:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFare();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = auth.currentUser;

        if (user) {
          // get the Firestore doc using UID from Firebase Auth
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            setCurrentUser(userData);
            setUserRole(userData.role || "User");
          }
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  // Format date to readable format (e.g., "March 9, 2025")
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get current fare update date for display using formatted date
  const getCurrentFareUpdateDate = () => {
    if (!currentFareData?.timestamp) return "Not set";
    return formatDate(currentFareData.timestamp.toDate());
  };

  // Handle saving fare with validation
  const handleSaveFare = async () => {
    // Reset all errors
    setNewBaseFareError("");
    setConfirmBaseFareError("");
    setNewDiscountError("");
    setConfirmDiscountError("");
    setBaseFareMatchError(false);
    setDiscountMatchError(false);

    let hasError = false;

    // Validate new base fare field
    if (!newBaseFare || newBaseFare.trim() === "") {
      setNewBaseFareError("New base fare is required");
      hasError = true;
    } else if (parseFloat(newBaseFare) <= 0 || isNaN(parseFloat(newBaseFare))) {
      setNewBaseFareError("New base fare must be a positive number");
      hasError = true;
    }

    // Validate confirm base fare field
    if (!confirmBaseFare || confirmBaseFare.trim() === "") {
      setConfirmBaseFareError("Please confirm the new base fare");
      hasError = true;
    } else if (parseFloat(confirmBaseFare) <= 0 || isNaN(parseFloat(confirmBaseFare))) {
      setConfirmBaseFareError("Confirm base fare must be a positive number");
      hasError = true;
    }

    // Validate new discount percentage field
    if (!newDiscountPercentage || newDiscountPercentage.trim() === "") {
      setNewDiscountError("New discount percentage is required");
      hasError = true;
    } else if (parseFloat(newDiscountPercentage) < 0 || parseFloat(newDiscountPercentage) > 100 || isNaN(parseFloat(newDiscountPercentage))) {
      setNewDiscountError("Discount percentage must be between 0 and 100");
      hasError = true;
    }

    // Validate confirm discount percentage field
    if (!confirmDiscountPercentage || confirmDiscountPercentage.trim() === "") {
      setConfirmDiscountError("Please confirm the new discount percentage");
      hasError = true;
    } else if (parseFloat(confirmDiscountPercentage) < 0 || parseFloat(confirmDiscountPercentage) > 100 || isNaN(parseFloat(confirmDiscountPercentage))) {
      setConfirmDiscountError("Discount percentage must be between 0 and 100");
      hasError = true;
    }

    // Check if base fares match (only if both are filled)
    if (!hasError && newBaseFare !== confirmBaseFare) {
      setBaseFareMatchError(true);
      hasError = true;
    }

    // Check if discount percentages match (only if both are filled)
    if (!hasError && newDiscountPercentage !== confirmDiscountPercentage) {
      setDiscountMatchError(true);
      hasError = true;
    }

    if (hasError) return;

    setPassword("");
    setPasswordError("");
    setIsModalOpen(true);
  };

  // Handle password verification and saving the fare - USING WORKING AUTH FROM QUOTA MANAGEMENT
  const handlePasswordSubmit = async () => {
    if (!password) {
      setPasswordError("Please enter your password.");
      return;
    }

    setSaving(true);

    try {
      const user = auth.currentUser;
      if (user) {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        const baseFareValue = parseFloat(newBaseFare);
        const discountValue = parseFloat(newDiscountPercentage);
        
        if (isNaN(baseFareValue) || baseFareValue <= 0) {
          setNewBaseFareError("Invalid base fare value");
          setSaving(false);
          setIsModalOpen(false);
          return;
        }

        if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
          setNewDiscountError("Invalid discount percentage value");
          setSaving(false);
          setIsModalOpen(false);
          return;
        }

        // Save to 'fares' collection with correct field names
        await addDoc(collection(db, "fares"), {
          basePrice: baseFareValue.toString(),
          discount: discountValue.toString(),
          timestamp: serverTimestamp(),
        });

        // Update local state
        setCurrentBaseFare(baseFareValue);
        setCurrentDiscountPercentage(discountValue);
        setCurrentFareData({
          basePrice: baseFareValue.toString(),
          discount: discountValue.toString(),
          timestamp: { toDate: () => new Date() },
        });

        // Log the fare update activity
        const userFullName = currentUser?.firstName && currentUser?.lastName 
          ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
          : user.email || "Unknown User";

        await logSystemActivity(
          `Updated base fare to ₱${baseFareValue.toLocaleString()} and discount to ${discountValue}%`,
          userFullName
        );

        // Reset form fields
        setNewBaseFare("");
        setConfirmBaseFare("");
        setNewDiscountPercentage("");
        setConfirmDiscountPercentage("");
        setPassword("");
        setPasswordError("");
        setNewBaseFareError("");
        setConfirmBaseFareError("");
        setNewDiscountError("");
        setConfirmDiscountError("");
        setBaseFareMatchError(false);
        setDiscountMatchError(false);

        setToastMessage(`Fare settings updated successfully!`);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);

        setIsModalOpen(false);
      }
    } catch (e) {
      console.error("Error reauthenticating or saving fare:", e);
      setPasswordError("Incorrect password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle reset fare
  const handleResetFare = () => {
    setResetPassword("");
    setResetPasswordError("");
    setIsResetModalOpen(true);
  };

  // Handle reset password verification - USING WORKING AUTH FROM QUOTA MANAGEMENT
  const handleResetPasswordSubmit = async () => {
    if (!resetPassword) {
      setResetPasswordError("Please enter your password.");
      return;
    }

    setResetting(true);

    try {
      const user = auth.currentUser;
      if (user) {
        const credential = EmailAuthProvider.credential(
          user.email,
          resetPassword
        );
        await reauthenticateWithCredential(user, credential);

        // Reset form fields and enable inputs by clearing current fare data
        setNewBaseFare("");
        setConfirmBaseFare("");
        setNewDiscountPercentage("");
        setConfirmDiscountPercentage("");
        setBaseFareMatchError(false);
        setDiscountMatchError(false);
        setNewBaseFareError("");
        setConfirmBaseFareError("");
        setNewDiscountError("");
        setConfirmDiscountError("");
        setResetPassword("");
        setResetPasswordError("");

        // Clear current fare data to enable fields
        setCurrentFareData(null);

        // Log the reset activity
        const userFullName = currentUser?.firstName && currentUser?.lastName 
          ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
          : user.email || "Unknown User";

        await logSystemActivity(
          "Reset fare fields for new fare setting",
          userFullName
        );

        setToastMessage(
          "Fare fields have been reset. You can now set new fare settings."
        );
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);

        setIsResetModalOpen(false);
      }
    } catch (e) {
      console.error("Error reauthenticating:", e);
      setResetPasswordError("Incorrect password. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  // Handle modal close (cancel button)
  const handleCancelModal = () => {
    setIsModalOpen(false);
    setPassword("");
    setPasswordError("");
    setSaving(false);
  };

  // Handle reset modal close
  const handleCancelResetModal = () => {
    setIsResetModalOpen(false);
    setResetPassword("");
    setResetPasswordError("");
    setResetting(false);
  };

  // Check if fields should be disabled - if fare settings exist and are set
  const shouldDisableFields = () => {
    return currentFareData !== null && 
           !newBaseFare && 
           !confirmBaseFare && 
           !newDiscountPercentage && 
           !confirmDiscountPercentage;
  };

  return (
    <div className="flex bg-gray-100 min-h-screen">
      {/* Main Content */}
      <main className="flex-1 p-10">
        <div className="mx-auto w-full max-w-[1200px]">
          <div
            className="bg-white border rounded-xl shadow-sm flex flex-col p-9"
            style={{ minHeight: "calc(70vh - 112px)" }}
          >
            <h1 className="text-2xl font-semibold text-gray-800 mb-6">
              Fare Management
            </h1>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="grid grid-cols-2 gap-10 mt-11">
                {/* Current Fare Settings */}
                <div className="flex flex-col items-center justify-center border-r pr-10">
                  <h2 className="text-lg font-semibold text-gray-600 mb-2 flex items-center gap-2 mt-1">
                    <Wallet className="w-8 h-8 text-blue-600" />
                    Current Fare Settings
                  </h2>
                  
                  {/* Base Fare */}
                  <div className="mb-8">
                    <p className="text-sm text-gray-500 text-center mb-1">Base Fare</p>
                    <div className="text-5xl font-bold text-gray-800 flex items-center justify-center gap-2">
                      <span>₱</span>
                      {currentBaseFare.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {/* Discount Percentage */}
                  <div className="mb-8">
                    <p className="text-sm text-gray-500 text-center mb-1">Discount Percentage</p>
                    <div className="text-5xl font-bold text-gray-800 flex items-center justify-center gap-2">
                      {currentDiscountPercentage.toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      <Percent className="w-10 h-10" />
                    </div>
                  </div>

                  {/* Last Updated Date */}
                  <div className="mt-6 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Last updated:</span>
                    <span>{getCurrentFareUpdateDate()}</span>
                  </div>
                </div>

                {/* Fare Change */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-semibold text-gray-600">
                      Fare Change
                    </h2>
                    {/* Show reset button only if fare data exists */}
                    {currentFareData && (
                      <button
                        onClick={handleResetFare}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-800 flex items-center justify-center"
                        title="Reset Fare Fields"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <p className="text-base text-gray-500 mb-4">
                    NOTE: If you want to modify the current fare settings, input the new
                    base fare and discount percentage, then retype them to confirm. This will
                    add a new fare record and apply to all transactions.
                  </p>

                  {/* Base Fare Section */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Base Fare</h3>
                    
                    <div className="mb-2">
                      <label className="block text-sm text-gray-600 mb-1">
                        New Base Fare <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Enter new base fare"
                        className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          newBaseFareError ? "border-red-500" : ""
                        }`}
                        value={newBaseFare}
                        onChange={(e) => {
                          setNewBaseFare(e.target.value);
                          setNewBaseFareError("");
                          setBaseFareMatchError(false);
                        }}
                        disabled={shouldDisableFields()}
                        step="0.01"
                        min="0"
                      />
                      {newBaseFareError && (
                        <p className="text-red-500 text-xs mt-1 font-semibold">
                          {newBaseFareError}
                        </p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">
                        Confirm New Base Fare <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Confirm new base fare"
                        className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          confirmBaseFareError || baseFareMatchError ? "border-red-500" : ""
                        }`}
                        value={confirmBaseFare}
                        onChange={(e) => {
                          setConfirmBaseFare(e.target.value);
                          setConfirmBaseFareError("");
                          setBaseFareMatchError(false);
                        }}
                        disabled={shouldDisableFields()}
                        step="0.01"
                        min="0"
                      />
                      {confirmBaseFareError && (
                        <p className="text-red-500 text-xs mt-1 font-semibold">
                          {confirmBaseFareError}
                        </p>
                      )}
                    </div>

                    {baseFareMatchError && (
                      <div className="flex items-center space-x-2 mt-2 mb-4">
                        <p className="text-red-500 text-sm font-semibold">
                          The base fare values do not match. Please ensure both fields contain the same value.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Discount Percentage Section */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Discount Percentage</h3>
                    
                    <div className="mb-2">
                      <label className="block text-sm text-gray-600 mb-1">
                        New Discount Percentage <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Enter new discount percentage (0-100)"
                        className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          newDiscountError ? "border-red-500" : ""
                        }`}
                        value={newDiscountPercentage}
                        onChange={(e) => {
                          setNewDiscountPercentage(e.target.value);
                          setNewDiscountError("");
                          setDiscountMatchError(false);
                        }}
                        disabled={shouldDisableFields()}
                        step="0.1"
                        min="0"
                        max="100"
                      />
                      {newDiscountError && (
                        <p className="text-red-500 text-xs mt-1 font-semibold">
                          {newDiscountError}
                        </p>
                      )}
                    </div>

                    <div className="mb-2">
                      <label className="block text-sm text-gray-600 mb-1">
                        Confirm New Discount Percentage <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Confirm new discount percentage"
                        className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          confirmDiscountError || discountMatchError ? "border-red-500" : ""
                        }`}
                        value={confirmDiscountPercentage}
                        onChange={(e) => {
                          setConfirmDiscountPercentage(e.target.value);
                          setConfirmDiscountError("");
                          setDiscountMatchError(false);
                        }}
                        disabled={shouldDisableFields()}
                        step="0.1"
                        min="0"
                        max="100"
                      />
                      {confirmDiscountError && (
                        <p className="text-red-500 text-xs mt-1 font-semibold">
                          {confirmDiscountError}
                        </p>
                      )}
                    </div>

                    {discountMatchError && (
                      <div className="flex items-center space-x-2 mt-2 mb-2">
                        <p className="text-red-500 text-sm font-semibold">
                          The discount percentage values do not match. Please ensure both fields contain the same value.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveFare}
                    disabled={shouldDisableFields()}
                    className="px-5 py-2 rounded-lg text-white shadow-md hover:opacity-95 self-start mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Password Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={handleCancelModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-12 px-16 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-6">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 text-center mb-4">
              Please enter your password to confirm
            </h2>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
            />
            {passwordError && (
              <p className="text-red-500 text-sm font-semibold text-center mb-4">
                {passwordError}
              </p>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleCancelModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {saving && (
                  <svg
                    className="h-5 w-5 animate-spin inline-block mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"
                    />
                  </svg>
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={handleCancelResetModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-12 px-16 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-6">
              <RotateCcw className="h-12 w-12 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 text-center mb-4">
              Reset Fare Fields
            </h2>
            <p className="text-gray-600 text-center mb-4">
              Enter your password to reset and unlock the fare fields
            </p>
            <input
              type="password"
              placeholder="Password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
            />
            {resetPasswordError && (
              <p className="text-red-500 text-sm font-semibold text-center mb-4">
                {resetPasswordError}
              </p>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleCancelResetModal}
                disabled={resetting}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPasswordSubmit}
                disabled={resetting}
                className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {resetting && (
                  <svg
                    className="h-5 w-5 animate-spin inline-block mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"
                    />
                  </svg>
                )}
                Reset Fields
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] transform transition-all duration-300 opacity-100 translate-y-0">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-5 py-3 text-green-800 shadow-md w-[520px] max-w-[90vw]">
            <div className="mt-0.5">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-green-500">
                <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <div className="text-sm">
              <div className="font-semibold">{toastMessage}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}