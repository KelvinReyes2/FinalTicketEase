import { useState, useEffect, useMemo } from "react";
import { Fuel, Users, UserCheck, DollarSign } from "lucide-react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import DataTable from "react-data-table-component";
import { FaEye } from "react-icons/fa";
import { exportToCSV, exportToPDF } from "../../functions/exportFunctions";

const FuelReport = () => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const userName =
    currentUser?.displayName || currentUser?.email || "Unknown User";

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get start of current week (Monday)
  const getWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, "0");
    const dayStr = String(monday.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayStr}`;
  };

  // Get start of current month
  const getMonthStart = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  };

  const [fuelPrice, setFuelPrice] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState("");
  const [filterMode, setFilterMode] = useState("today");
  const [driverRelieverCount, setDriverRelieverCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("Unknown");
  const [currentUserFullName, setCurrentUserFullName] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [stats, setStats] = useState({
    driversRelievers: 0,
    officersFueled: 0,
    totalFuelExpense: 0,
  });

  const primaryColor = "#364C6E";

  const getDateFromTimestamp = (timestamp) => {
    try {
      if (timestamp && typeof timestamp.toDate === "function") {
        return timestamp.toDate();
      } else if (timestamp && timestamp.seconds) {
        return new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        return timestamp;
      } else if (
        typeof timestamp === "string" &&
        !isNaN(Date.parse(timestamp))
      ) {
        return new Date(timestamp);
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error converting timestamp:", error);
      return null;
    }
  };

  // Helper function to format timestamp with time and date
  const formatTimestamp = (timestamp) => {
    try {
      const date = getDateFromTimestamp(timestamp);
      if (!date) {
        return { time: "N/A", date: "N/A", fullDateTime: "N/A" };
      }

      // Format time (e.g., 10:28 AM)
      const time = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Format date (e.g., September 17, 2025)
      const dateStr = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      // Full date time for export
      const fullDateTime = `${dateStr}, ${time}`;

      return { time, date: dateStr, fullDateTime };
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return { time: "Invalid", date: "Invalid", fullDateTime: "Invalid" };
    }
  };

  // Show success toast
  const showToast = (message) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  // Show error toast
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3000);
  };

  // Fetch current user's role and full name
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUserRole(userData.role || "Unknown");
            setCurrentUserFullName({
              firstName: userData.firstName || "",
              middleName: userData.middleName || "",
              lastName: userData.lastName || "",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    fetchCurrentUserData();
  }, [currentUser]);

  // Fetch Drivers & Relievers Count
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const usersRef = collection(db, "users");
        const driversSnapshot = await getDocs(
          query(usersRef, where("role", "in", ["Driver", "Reliever"]))
        );
        setDriverRelieverCount(driversSnapshot.size);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchCounts();
  }, []);

  // Fetch Fuel Logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const logsRef = collection(db, "fuelLogs");
        const q = query(logsRef, orderBy("timestamp", "desc"));
        
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            const data = snapshot.docs.map((doc) => {
              const log = doc.data();
              return {
                id: doc.id,
                date: log.timestamp?.toDate
                  ? log.timestamp.toDate().toLocaleDateString()
                  : "N/A",
                driver: log.Driver || "N/A",
                officer: log.Officer || "N/A",
                driverId: log.driverId || "N/A",
                amount: parseFloat(log.fuelAmount) || 0,
                vehicle: log.Vehicle || "N/A",
                timestamp: log.timestamp,
                status: log.status || "pending",
              };
            });
            setLogs(data);
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching logs:", error);
            setLoading(false);
          }
        );

        return () => unsub();
      } catch (err) {
        console.error("Error fetching logs:", err);
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // Fetch Latest Fuel Price
  useEffect(() => {
    const fetchFuelPrice = async () => {
      try {
        const fuelPriceRef = collection(db, "fuelPrice");
        const q = query(fuelPriceRef, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const latest = snapshot.docs[0].data();
          setFuelPrice(parseFloat(latest.Price) || 0);
        }
      } catch (err) {
        console.error("Error fetching fuel price:", err);
      }
    };

    fetchFuelPrice();
  }, []);

  const handleFilterChange = (mode) => {
    setFilterMode(mode);
    const today = getTodayDate();

    switch (mode) {
      case "today":
        setStartDate(today);
        setEndDate("");
        break;
      case "week":
        setStartDate(getWeekStart());
        setEndDate(today);
        break;
      case "month":
        setStartDate(getMonthStart());
        setEndDate(today);
        break;
      case "custom":
        // Keep current dates
        break;
      default:
        break;
    }
  };

  const handleResetDates = () => {
    setFilterMode("today");
    setStartDate(getTodayDate());
    setEndDate("");
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Role filter
      const matchesRole =
        roleFilter === "All" || log.officer === roleFilter;

      // Search filter
      const matchesSearch = search
        ? log.driver.toLowerCase().includes(search.toLowerCase()) ||
          log.officer.toLowerCase().includes(search.toLowerCase()) ||
          log.vehicle.toLowerCase().includes(search.toLowerCase())
        : true;

      // Date filter
      const logDate = getDateFromTimestamp(log.timestamp);
      let matchesDate = true;

      if (logDate) {
        const year = logDate.getFullYear();
        const month = String(logDate.getMonth() + 1).padStart(2, "0");
        const day = String(logDate.getDate()).padStart(2, "0");
        const logDateString = `${year}-${month}-${day}`;

        if (startDate && !endDate) {
          matchesDate = logDateString === startDate;
        } else if (startDate && endDate) {
          matchesDate =
            logDateString >= startDate && logDateString <= endDate;
        } else if (!startDate && endDate) {
          matchesDate = logDateString <= endDate;
        }
      }

      return matchesRole && matchesSearch && matchesDate;
    });
  }, [logs, roleFilter, search, startDate, endDate]);

  // Calculate stats based on filtered logs
  useEffect(() => {
    if (!filteredLogs.length) {
      setStats({
        driversRelievers: driverRelieverCount,
        officersFueled: 0,
        totalFuelExpense: 0,
      });
      return;
    }

    const totalFuelExpense = filteredLogs.reduce(
      (sum, log) => sum + (parseFloat(log.amount) || 0) * fuelPrice,
      0
    );

    setStats({
      driversRelievers: driverRelieverCount,
      officersFueled: new Set(
        filteredLogs
          .filter((log) => log.status === "done" && log.driver)
          .map((log) => log.driver)
      ).size,
      totalFuelExpense,
    });
  }, [filteredLogs, fuelPrice, driverRelieverCount]);

  // Get unique officers for role filter
  const uniqueOfficers = useMemo(() => {
    const officers = new Set(logs.map((log) => log.officer));
    return Array.from(officers).sort();
  }, [logs]);

  // Format exported by name
  const getFormattedExportedByName = () => {
    const { firstName, middleName, lastName } = currentUserFullName;
    if (middleName) {
      return `${firstName} ${middleName} ${lastName}`;
    }
    return `${firstName} ${lastName}`;
  };

  // Export functions
  const headers = [
    "ID",
    "Timestamp",
    "Driver Name",
    "Officer",
    "Amount Spent",
    "Unit",
  ];

  const rows = filteredLogs.map((log, index) => {
    const { fullDateTime } = formatTimestamp(log.timestamp);
    return [
      index + 1,
      fullDateTime,
      log.driver,
      log.officer,
      `${log.amount.toFixed(2)}`,
      log.vehicle,
    ];
  });

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const handleExportToCSV = async () => {
    try {
      await exportToCSV(
        headers,
        rows,
        "Fuel-Report.csv",
        getFormattedExportedByName(),
        "Fuel-Report"
      );

      setIsDropdownOpen(false);
      showToast("Fuel report exported to CSV successfully!");
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      showError("Failed to export to CSV.");
    }
  };

  const handleExportToPDF = async () => {
    try {
      await exportToPDF(
        headers,
        rows,
        "Fuel-Report",
        "Fuel-Report.pdf",
        getFormattedExportedByName()
      );

      setIsDropdownOpen(false);
      showToast("Fuel report exported to PDF successfully!");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      showError("Failed to export to PDF.");
    }
  };

  // Add row numbers for display
  const filteredWithRowNumber = useMemo(
    () => filteredLogs.map((r, i) => ({ ...r, _row: i + 1 })),
    [filteredLogs]
  );

  // Table Columns
  const columns = [
    {
      name: "ID",
      selector: (r) => r._row,
      sortable: false,
      width: "80px",
      right: true,
    },
    {
      name: "Timestamp",
      selector: (r) => r.timestamp,
      sortable: true,
      grow: 1,
      cell: (r) => {
        const { time, date } = formatTimestamp(r.timestamp);
        return (
          <div className="text-sm">
            <div className="font-medium">{time}</div>
            <div className="text-gray-600 text-xs">{date}</div>
          </div>
        );
      },
    },
    {
      name: "Driver Name",
      selector: (r) => r.driver,
      sortable: true,
      grow: 1,
      cell: (r) => (
        <div className="truncate" title={r.driver}>
          {r.driver}
        </div>
      ),
    },
    {
      name: "Officer",
      selector: (r) => r.officer,
      sortable: true,
      grow: 1,
      cell: (r) => (
        <div className="truncate" title={r.officer}>
          {r.officer}
        </div>
      ),
    },
    {
      name: "Amount Spent",
      selector: (r) => r.amount,
      sortable: true,
      center: true,
      grow: 1,
      cell: (r) => `₱${r.amount.toFixed(2)}`,
    },
    {
      name: "Unit",
      selector: (r) => r.vehicle,
      sortable: true,
      center: true,
      grow: 1,
    },
    {
      name: "Action",
      button: true,
      center: true,
      width: "120px",
      cell: (row) => (
        <button
          onClick={() => setViewing(row)}
          title="View Details"
          className="inline-flex items-center justify-center h-9 px-3 rounded-full border border-gray-200 bg-white text-gray-700 hover:shadow-md transition text-sm font-semibold"
        >
          <FaEye size={14} />
        </button>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
    },
  ];

  // Table Styles
  const tableStyles = {
    table: {
      style: { borderRadius: "1rem", width: "100%", tableLayout: "auto" },
    },
    headRow: {
      style: {
        minHeight: "40px",
        backgroundColor: primaryColor,
        borderTopLeftRadius: "0.75rem",
        borderTopRightRadius: "0.75rem",
        borderBottom: "1px solid #e5e7eb",
        position: "sticky",
        top: 0,
        zIndex: 1,
      },
    },
    headCells: {
      style: {
        fontWeight: 700,
        color: "#ffffff",
        fontSize: "14px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "10px 12px",
        alignItems: "center",
        whiteSpace: "nowrap",
      },
    },
    rows: { style: { minHeight: "44px", borderBottom: "1px solid #f1f5f9" } },
    cells: {
      style: {
        padding: "14px 12px",
        fontSize: "14px",
        color: "#0f172a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    },
  };

  return (
    <main className="flex-1 p-8 mx-auto">
      <div className="mx-auto w-full max-w-[1900px]">
        <div
          className="bg-white border rounded-2xl shadow-md flex flex-col"
          style={{ minHeight: "calc(100vh - 112px)" }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b">
            <h1 className="text-2xl font-semibold text-gray-800 mb-4">
              Fuel Report
            </h1>

            {/* Filter Mode Buttons */}
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => handleFilterChange("today")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterMode === "today"
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  filterMode === "today"
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                Today
              </button>
              <button
                onClick={() => handleFilterChange("week")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterMode === "week"
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  filterMode === "week"
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                This Week
              </button>
              <button
                onClick={() => handleFilterChange("month")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterMode === "month"
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  filterMode === "month"
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                This Month
              </button>
              <button
                onClick={() => handleFilterChange("custom")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterMode === "custom"
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  filterMode === "custom"
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                Custom Range
              </button>
            </div>

            {/* Date Inputs and Filters */}
            <div className="flex flex-wrap gap-4 items-end">
              {filterMode === "custom" && (
                <>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleResetDates}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Reset
                  </button>
                </>
              )}

              {/* Role Filter */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-600 mb-1">
                  Filter by Officer
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  style={{ width: '200px' }}
                >
                  <option value="All">All Officers</option>
                  {uniqueOfficers.map((officer) => (
                    <option key={officer} value={officer}>
                      {officer}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search - Now Short and Compact */}
              <div className="flex flex-col" style={{ width: '250px' }}>
                <label className="text-sm font-medium text-gray-600 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search..."
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Export Button */}
              <div className="relative">
                <button
                  onClick={toggleDropdown}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg text-white shadow-md hover:shadow-lg transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="font-semibold">Export</span>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 w-40 mt-2 bg-white shadow-lg rounded-lg z-10">
                    <ul className="text-sm">
                      <li>
                        <button
                          onClick={handleExportToCSV}
                          className="block px-4 py-2 text-gray-800 hover:bg-gray-100 w-full text-left"
                        >
                          Export to Excel
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={handleExportToPDF}
                          className="block px-4 py-2 text-gray-800 hover:bg-gray-100 w-full text-left"
                        >
                          Export to PDF
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Show selected date range */}
            <div className="mt-3 text-sm text-gray-600">
              {filterMode === "today" && (
                <p>
                  Showing data for: <strong>Today</strong>
                </p>
              )}
              {filterMode === "week" && (
                <p>
                  Showing data for: <strong>This Week</strong> (
                  {getWeekStart()} to {getTodayDate()})
                </p>
              )}
              {filterMode === "month" && (
                <p>
                  Showing data for: <strong>This Month</strong> (
                  {getMonthStart()} to {getTodayDate()})
                </p>
              )}
              {filterMode === "custom" && startDate && (
                <p>
                  Showing data from: <strong>{startDate}</strong>
                  {endDate && (
                    <>
                      {" "}
                      to <strong>{endDate}</strong>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4 border">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Fuel className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fuel Price</p>
                  <p className="text-2xl font-semibold">
                    ₱{fuelPrice.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4 border">
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    Number of Drivers/Relievers
                  </p>
                  <p className="text-2xl font-semibold">
                    {stats.driversRelievers}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4 border">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <UserCheck className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fueled Drivers</p>
                  <p className="text-2xl font-semibold">
                    {stats.officersFueled}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4 border">
                <div className="p-3 bg-red-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Fuel Expenses</p>
                  <p className="text-2xl font-semibold">
                    ₱{stats.totalFuelExpense.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="px-6 pb-6 flex-1">
            <div className="bg-white border rounded-2xl shadow overflow-hidden">
              <DataTable
                columns={columns}
                data={filteredWithRowNumber}
                progressPending={loading}
                customStyles={tableStyles}
                highlightOnHover
                striped
                dense
                persistTableHead
                responsive
                pagination
                paginationComponentOptions={{ noRowsPerPage: true }}
                fixedHeader
                fixedHeaderScrollHeight="50vh"
              />
            </div>
          </div>

          {/* View Fuel Log Modal */}
          {viewing && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setViewing(null)}
            >
              <div
                className="relative bg-white rounded-2xl shadow-2xl w-[850px] max-w-[94%] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex items-center justify-between px-8 py-6 border-b bg-white/70 backdrop-blur">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full grid place-items-center text-white shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Fuel className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">
                        Fuel Expense Details
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatTimestamp(viewing.timestamp).fullDateTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setViewing(null)}
                      className="h-10 w-10 rounded-full grid place-items-center border border-gray-200 hover:bg-gray-50"
                      title="Close"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-12 grid grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Driver Name
                    </label>
                    <p className="text-xl text-gray-800 font-semibold">
                      {viewing.driver}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Officer
                    </label>
                    <p className="text-xl text-gray-800 font-semibold">
                      {viewing.officer}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Amount Spent
                    </label>
                    <p className="text-xl text-gray-800 font-bold">
                      ₱{viewing.amount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Unit
                    </label>
                    <p className="text-xl text-gray-800 font-semibold">
                      {viewing.vehicle}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Timestamp
                    </label>
                    <p className="text-xl text-gray-800 font-semibold">
                      {formatTimestamp(viewing.timestamp).fullDateTime}
                    </p>
                  </div>
                </div>

                <div className="px-8 py-6 border-t bg-gray-50/50 backdrop-blur flex justify-end">
                  <button
                    className="px-6 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
                    onClick={() => setViewing(null)}
                  >
                    Close
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

          {/* Error Toast */}
          {showErrorToast && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] transform transition-all duration-300 opacity-100 translate-y-0">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-red-800 shadow-md w-[520px] max-w-[90vw]">
                <div className="mt-0.5">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-red-500">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="font-semibold">{errorMessage}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default FuelReport;