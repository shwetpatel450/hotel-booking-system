const app = angular.module("hotelApp", ["ngRoute"]);

app.constant("API_BASE_URL", "http://localhost:5000/api");

app.config([
  "$routeProvider",
  "$locationProvider",
  function configRoutes($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix("!");

    $routeProvider
      .when("/", { template: homeTemplate() })
      .when("/contact", { template: contactTemplate(), controller: "ContactController", controllerAs: "vm" })
      .when("/login", { template: loginTemplate(), controller: "AuthController", controllerAs: "vm" })
      .when("/register", { template: registerTemplate(), controller: "AuthController", controllerAs: "vm" })
      .when("/rooms", { template: roomsTemplate(), controller: "RoomController", controllerAs: "vm" })
      .when("/bookings", { template: bookingsTemplate(), controller: "BookingController", controllerAs: "vm" })
      .when("/admin", { template: adminTemplate(), controller: "AdminController", controllerAs: "vm" })
      .otherwise({ redirectTo: "/" });
  },
]);

app.factory("AuthService", [
  "$http",
  "$window",
  "API_BASE_URL",
  function AuthService($http, $window, API_BASE_URL) {
    const key = "hostel_booking_auth";

    function saveSession(payload) {
      $window.localStorage.setItem(key, JSON.stringify(payload));
    }

    function getSession() {
      const raw = $window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }

    function clearSession() {
      $window.localStorage.removeItem(key);
    }

    function getToken() {
      const session = getSession();
      return session && session.token ? session.token : "";
    }

    function authHeaders() {
      return getToken() ? { Authorization: "Bearer " + getToken() } : {};
    }

    return {
      register: (data) => $http.post(API_BASE_URL + "/auth/register", data),
      login: (data) => $http.post(API_BASE_URL + "/auth/login", data),
      saveSession,
      getSession,
      clearSession,
      isAuthenticated: () => !!getToken(),
      authHeaders,
    };
  },
]);

app.factory("ApiService", [
  "$http",
  "API_BASE_URL",
  "AuthService",
  function ApiService($http, API_BASE_URL, AuthService) {
    function get(url, params) {
      return $http.get(API_BASE_URL + url, { params, headers: AuthService.authHeaders() });
    }
    function post(url, data) {
      return $http.post(API_BASE_URL + url, data, { headers: AuthService.authHeaders() });
    }
    function del(url) {
      return $http.delete(API_BASE_URL + url, { headers: AuthService.authHeaders() });
    }
    return { get, post, del };
  },
]);

app.controller("MainController", [
  "$scope",
  "$location",
  "$window",
  "AuthService",
  function MainController($scope, $location, $window, AuthService) {
    const vm = this;

    function refreshSession() {
      vm.session = AuthService.getSession();
      vm.currentUser = vm.session ? vm.session.user : null;
    }

    function updateRouteState() {
      const hash = ($window.location && $window.location.hash) || "";
      vm.isAuthPage = hash.includes("#!/login") || hash.includes("#!/register");
    }

    refreshSession();
    updateRouteState();
    vm.currentYear = new Date().getFullYear();

    vm.isAuthenticated = AuthService.isAuthenticated;

    vm.logout = function logout() {
      AuthService.clearSession();
      refreshSession();
      $location.path("/login");
    };

    $scope.$on("$routeChangeSuccess", function onRouteChange() {
      refreshSession();
      updateRouteState();
    });
  },
]);

app.controller("AuthController", [
  "$location",
  "AuthService",
  function AuthController($location, AuthService) {
    const vm = this;
    vm.form = { role: "user" };
    vm.error = "";

    vm.login = function login() {
      vm.error = "";
      AuthService.login(vm.form)
        .then((res) => {
          AuthService.saveSession(res.data);
          $location.path("/rooms");
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Invalid login";
        });
    };

    vm.register = function register() {
      vm.error = "";
      vm.form.role = "user";
      AuthService.register(vm.form)
        .then((res) => {
          AuthService.saveSession(res.data);
          $location.path("/rooms");
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Registration failed";
        });
    };
  },
]);

app.controller("RoomController", [
  "$scope",
  "$interval",
  "ApiService",
  "AuthService",
  function RoomController($scope, $interval, ApiService, AuthService) {
    const vm = this;
    vm.rooms = [];
    vm.error = "";
    vm.success = "";
    const session = AuthService.getSession();
    vm.isAdmin = !!(session && session.user && session.user.role === "admin");
    function formatDate(date) {
      return new Date(date).toISOString().slice(0, 10);
    }

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    vm.filters = {
      type: "",
      minPrice: "",
      maxPrice: "",
      guests: 1,
      checkInDate: formatDate(today),
      checkOutDate: formatDate(tomorrow),
      couponCode: "",
      onlyAvailable: true,
    };

    function loadRooms() {
      vm.error = "";
      vm.success = "";
      ApiService.get("/rooms", vm.filters)
        .then((res) => {
          vm.rooms = res.data;
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Unable to load rooms";
        });
    }

    vm.applyFilters = function applyFilters() {
      if (!vm.filters.checkInDate || !vm.filters.checkOutDate) {
        vm.error = "Select check-in and check-out to see real availability.";
        return;
      }
      if (new Date(vm.filters.checkOutDate) <= new Date(vm.filters.checkInDate)) {
        vm.error = "Check-out must be after check-in.";
        return;
      }
      loadRooms();
    };

    vm.bookNow = function bookNow(room) {
      vm.error = "";
      vm.success = "";

      if (!AuthService.isAuthenticated()) {
        vm.error = "Please login first to book a room.";
        return;
      }

      const checkIn = vm.filters.checkInDate;
      const checkOut = vm.filters.checkOutDate;
      const guests = Number(vm.filters.guests || 1);

      if (!checkIn || !checkOut) {
        vm.error = "Please choose dates before booking.";
        return;
      }

      ApiService.post("/bookings", {
        room: room._id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        couponCode: vm.filters.couponCode,
      })
        .then(() => {
          vm.success = "Booking confirmed successfully.";
          vm.filters.onlyAvailable = true;
          loadRooms();
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Booking failed.";
        });
    };

    loadRooms();

    // Keep availability in sync across users without manual refresh.
    const refreshTimer = $interval(function refreshAvailability() {
      loadRooms();
    }, 15000);

    $scope.$on("$destroy", function cleanupRefreshTimer() {
      $interval.cancel(refreshTimer);
    });
  },
]);

app.controller("BookingController", [
  "ApiService",
  function BookingController(ApiService) {
    const vm = this;
    vm.bookings = [];
    vm.error = "";

    vm.load = function load() {
      ApiService.get("/bookings")
        .then((res) => {
          vm.bookings = res.data;
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Unable to fetch bookings.";
        });
    };

    vm.cancel = function cancel(id) {
      ApiService.del("/bookings/" + id)
        .then(() => vm.load())
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Unable to cancel booking.";
        });
    };

    vm.load();
  },
]);

app.controller("AdminController", [
  "ApiService",
  function AdminController(ApiService) {
    const vm = this;
    vm.report = {};
    vm.rooms = [];
    vm.contactMessages = [];
    vm.newRoom = { type: "standard" };
    vm.message = "";

    vm.loadData = function loadData() {
      vm.message = "";
      vm.roomError = "";
      ApiService.get("/reports/dashboard")
        .then((res) => {
          vm.report = res.data;
        })
        .catch((err) => {
          vm.message = (err.data && err.data.message) || "Admin access required.";
        });

      ApiService.get("/rooms")
        .then((res) => {
          vm.rooms = res.data;
        })
        .catch((err) => {
          vm.roomError = (err.data && err.data.message) || "Unable to load rooms.";
        });

      ApiService.get("/contact")
        .then((res) => {
          vm.contactMessages = res.data;
        })
        .catch((err) => {
          vm.contactError = (err.data && err.data.message) || "Unable to load contact messages.";
        });
    };

    vm.addRoom = function addRoom() {
      ApiService.post("/rooms", vm.newRoom)
        .then(() => {
          vm.newRoom = { type: "standard" };
          vm.loadData();
        })
        .catch((err) => {
          vm.message = (err.data && err.data.message) || "Unable to add room.";
        });
    };

    vm.deleteRoom = function deleteRoom(id) {
      ApiService.del("/rooms/" + id)
        .then(() => vm.loadData())
        .catch((err) => {
          vm.message = (err.data && err.data.message) || "Unable to delete room.";
        });
    };

    vm.loadData();
  },
]);

app.controller("ContactController", [
  "$http",
  "API_BASE_URL",
  function ContactController($http, API_BASE_URL) {
    const vm = this;
    vm.form = { name: "", email: "", message: "" };
    vm.error = "";
    vm.success = "";
    vm.submitting = false;

    vm.submit = function submit() {
      vm.error = "";
      vm.success = "";
      vm.submitting = true;

      $http
        .post(API_BASE_URL + "/contact", vm.form)
        .then((res) => {
          vm.success = (res.data && res.data.message) || "Message sent successfully.";
          vm.form = { name: "", email: "", message: "" };
        })
        .catch((err) => {
          vm.error = (err.data && err.data.message) || "Unable to send message right now.";
        })
        .finally(() => {
          vm.submitting = false;
        });
    };
  },
]);

function homeTemplate() {
  return `
    <section class="hero card p-4 p-lg-5 mb-4">
      <div class="row g-4 align-items-center">
        <div class="col-lg-7">
          <p class="eyebrow mb-2">WELCOME TO BLUEPEAK HOSTEL</p>
          <h1 class="display-5 fw-bold mb-3">Modern Hotel Stays, Professionally Managed</h1>
          <p class="lead text-soft mb-4">Book by date, view real-time room status, and enjoy a seamless experience for students, interns, and travelers.</p>
          <div class="d-flex flex-wrap gap-2">
            <a href="#!/rooms" class="btn btn-warning px-4">Book a Room</a>
            <a href="#!/register" class="btn btn-outline-light px-4">Create Account</a>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="hero-glass p-3">
            <p class="small mb-2 text-soft">Today at BluePeak</p>
            <div class="d-flex justify-content-between py-2 border-bottom border-light-subtle">
              <span>Rooms</span><strong>24</strong>
            </div>
            <div class="d-flex justify-content-between py-2 border-bottom border-light-subtle">
              <span>Room Types</span><strong>Standard / Deluxe / Suite</strong>
            </div>
            <div class="d-flex justify-content-between py-2">
              <span>Support</span><strong>24 x 7 Front Desk</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="row g-3 mb-3">
      <div class="col-sm-6 col-lg-3"><div class="card stat-card p-3"><p class="small mb-1">Rooms</p><h4 class="mb-0">24+</h4></div></div>
      <div class="col-sm-6 col-lg-3"><div class="card stat-card p-3"><p class="small mb-1">Happy Guests</p><h4 class="mb-0">2,000+</h4></div></div>
      <div class="col-sm-6 col-lg-3"><div class="card stat-card p-3"><p class="small mb-1">Avg Rating</p><h4 class="mb-0">4.8 / 5</h4></div></div>
      <div class="col-sm-6 col-lg-3"><div class="card stat-card p-3"><p class="small mb-1">Support</p><h4 class="mb-0">24 x 7</h4></div></div>
    </section>

    <section class="row g-3 mb-3">
      <div class="col-md-4">
        <div class="card ui-card p-3 h-100">
          <h5 class="mb-2">Live Availability</h5>
          <p class="small text-muted mb-0">See exactly which rooms are free for your selected check-in and check-out dates.</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card ui-card p-3 h-100">
          <h5 class="mb-2">Secure Experience</h5>
          <p class="small text-muted mb-0">Protected login, JWT authentication, and role-based access for users and admin.</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card ui-card p-3 h-100">
          <h5 class="mb-2">Fast Booking Flow</h5>
          <p class="small text-muted mb-0">Search, filter, and confirm your hotel stay in a clean and responsive interface.</p>
        </div>
      </div>
    </section>

    <section class="card ui-card p-4 mb-3">
      <h3 class="mb-3">Choose Your Room Style</h3>
      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <article class="preview-card">
            <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80" alt="Standard room" />
            <div class="preview-body">
              <h6 class="mb-1">Standard Room</h6>
              <p class="small text-muted mb-0">Budget-friendly, clean, and ideal for solo stays.</p>
            </div>
          </article>
        </div>
        <div class="col-md-4">
          <article class="preview-card">
            <img src="https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=900&q=80" alt="Deluxe room" />
            <div class="preview-body">
              <h6 class="mb-1">Deluxe Room</h6>
              <p class="small text-muted mb-0">More space, better comfort, perfect for friends or couples.</p>
            </div>
          </article>
        </div>
        <div class="col-md-4">
          <article class="preview-card">
            <img src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80" alt="Suite room" />
            <div class="preview-body">
              <h6 class="mb-1">Suite Room</h6>
              <p class="small text-muted mb-0">Premium setup with extra comfort for families and groups.</p>
            </div>
          </article>
        </div>
      </div>

      <div class="row g-4 align-items-center">
        <div class="col-lg-8">
          <h3 class="mb-3">Why Guests Choose BluePeak</h3>
          <div class="row g-3">
            <div class="col-md-6"><div class="feature-chip">High-speed Wi-Fi in all rooms</div></div>
            <div class="col-md-6"><div class="feature-chip">Clean and secure hotel floors</div></div>
            <div class="col-md-6"><div class="feature-chip">Common lounge and study area</div></div>
            <div class="col-md-6"><div class="feature-chip">Affordable plans for students and travelers</div></div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="promo-box p-3">
            <p class="small text-muted mb-1">Ready to stay with us?</p>
            <h5 class="mb-3">Find your room in less than 2 minutes.</h5>
            <a href="#!/rooms" class="btn btn-primary w-100">Explore Available Rooms</a>
          </div>
        </div>
      </div>
    </section>

    <section class="card ui-card p-4">
      <h4 class="mb-3">Guest Feedback</h4>
      <div class="row g-3">
        <div class="col-md-4"><div class="quote-card">"Clean rooms and smooth booking process. Loved the speed." <span>- Ananya</span></div></div>
        <div class="col-md-4"><div class="quote-card">"Availability status is accurate and the staff is very helpful." <span>- Rahul</span></div></div>
        <div class="col-md-4"><div class="quote-card">"Best hotel UI and easy booking for our team trip." <span>- Faizan</span></div></div>
      </div>
    </section>
  `;
}

function loginTemplate() {
  return `
    <div class="row justify-content-center auth-page">
      <div class="col-lg-5 col-md-7">
        <div class="card ui-card p-4 auth-card">
          <div class="mb-3">
            <h3 class="mb-1">Login</h3>
            <p class="text-muted mb-0">Sign in to book rooms and manage your bookings.</p>
          </div>

          <div class="alert alert-danger" ng-if="vm.error">{{ vm.error }}</div>

          <form ng-submit="vm.login()">
            <label class="form-label">Email</label>
            <input class="form-control auth-input mb-3" type="email" ng-model="vm.form.email" required autocomplete="email" />

            <label class="form-label">Password</label>
            <input class="form-control auth-input mb-3" type="password" ng-model="vm.form.password" required autocomplete="current-password" />

            <button class="btn btn-primary w-100 auth-btn">Sign In</button>

            <div class="mt-3 text-center">
              <span class="small text-muted">New here?</span>
              <a href="#!/register" class="ms-2 auth-link">Create an account</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function registerTemplate() {
  return `
    <div class="row justify-content-center auth-page">
      <div class="col-lg-6 col-md-8">
        <div class="card ui-card p-4 auth-card">
          <div class="mb-3">
            <h3 class="mb-1">Create Account</h3>
            <p class="text-muted mb-0">Get started in seconds — choose rooms and confirm bookings instantly.</p>
          </div>

          <div class="alert alert-danger" ng-if="vm.error">{{ vm.error }}</div>

          <form ng-submit="vm.register()">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Name</label>
                <input class="form-control auth-input" ng-model="vm.form.name" required autocomplete="name" />
              </div>

              <div class="col-md-6">
                <label class="form-label">Email</label>
                <input class="form-control auth-input" type="email" ng-model="vm.form.email" required autocomplete="email" />
              </div>

              <div class="col-md-6">
                <label class="form-label">Phone</label>
                <input class="form-control auth-input" type="tel" ng-model="vm.form.phone" required autocomplete="tel" placeholder="+91 9XXXXXXXXX" />
              </div>

              <div class="col-md-6">
                <label class="form-label">Gender (optional)</label>
                <select class="form-select auth-input" ng-model="vm.form.gender">
                  <option value="" selected>Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div class="col-md-12">
                <label class="form-label">Password</label>
                <input class="form-control auth-input" type="password" ng-model="vm.form.password" required autocomplete="new-password" />
              </div>
            </div>

            <button class="btn btn-gold w-100 mt-4 auth-btn">Register</button>

            <div class="mt-3 text-center">
              <span class="small text-muted">Already have an account?</span>
              <a href="#!/login" class="ms-2 auth-link">Login</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function roomsTemplate() {
  return `
    <section class="card ui-card p-3 p-md-4 mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h3 class="mb-0">Rooms at BluePeak Hotel</h3>
        <span class="badge bg-primary">Live Availability</span>
      </div>
      <div class="row g-2">
        <div class="col-md-2"><input type="date" class="form-control" ng-model="vm.filters.checkInDate" /></div>
        <div class="col-md-2"><input type="date" class="form-control" ng-model="vm.filters.checkOutDate" /></div>
        <div class="col-md-2"><input type="number" class="form-control" min="1" placeholder="Guests" ng-model="vm.filters.guests" /></div>
        <div class="col-md-2">
          <select class="form-select" ng-model="vm.filters.type">
            <option value="">All types</option><option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="suite">Suite</option>
          </select>
        </div>
        <div class="col-md-2"><input type="number" class="form-control" placeholder="Max price" ng-model="vm.filters.maxPrice" /></div>
        <div class="col-md-2"><button class="btn btn-primary w-100" ng-click="vm.applyFilters()">Search</button></div>
      </div>
      <div class="row g-2 mt-1">
        <div class="col-md-4" ng-if="!vm.isAdmin">
          <input type="text" class="form-control" placeholder="Coupon code (try SAVE10)" ng-model="vm.filters.couponCode" />
        </div>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="checkbox" id="availableOnly" ng-model="vm.filters.onlyAvailable" />
        <label class="form-check-label" for="availableOnly">Show available rooms only</label>
      </div>
      <p class="text-danger mt-2 mb-0" ng-if="vm.error">{{ vm.error }}</p>
      <p class="text-success mt-2 mb-0" ng-if="vm.success">{{ vm.success }}</p>
    </section>
    <section class="row g-3">
      <div class="col-md-6 col-xl-4" ng-repeat="room in vm.rooms track by room._id">
        <article class="card room-card h-100">
          <img class="room-image w-100" ng-src="{{ room.imageUrl }}" alt="Room image" />
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <h5 class="mb-1">{{ room.type | uppercase }} - {{ room.roomNumber }}</h5>
              <span class="badge" ng-class="room.isAvailableForDates ? 'bg-success' : 'bg-danger'">{{ room.isAvailableForDates ? 'Available' : 'Booked' }}</span>
            </div>
            <p class="small text-muted mb-1">Capacity: {{ room.capacity }} guest(s)</p>
            <p class="fw-semibold">Rs {{ room.pricePerNight }} / night</p>
            <div class="d-flex flex-wrap gap-1 mb-2">
              <span class="badge text-bg-light border" ng-repeat="a in room.amenities track by $index">{{ a }}</span>
            </div>
            <div class="row g-2">
              <div class="col-7"><p class="small text-muted mb-0 pt-2">Booking uses the selected search dates above.</p></div>
              <div class="col-5" ng-if="!vm.isAdmin"><button class="btn btn-warning btn-sm w-100" ng-disabled="!room.isAvailableForDates" ng-click="vm.bookNow(room)">Book</button></div>
              <div class="col-5" ng-if="vm.isAdmin"><button class="btn btn-outline-secondary btn-sm w-100" disabled>Admin View</button></div>
            </div>
          </div>
        </article>
      </div>
    </section>
    <section class="alert alert-info mt-3 mb-0" ng-if="vm.isAdmin">
      Admin accounts can manage rooms and reports but cannot create room bookings.
    </section>
  `;
}

function bookingsTemplate() {
  return `
    <div class="card ui-card p-3">
      <h3 class="mb-3">My Bookings</h3>
      <p class="text-danger" ng-if="vm.error">{{ vm.error }}</p>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Room</th><th>Dates</th><th>Status</th><th>Billing Breakdown</th><th></th></tr></thead>
          <tbody>
            <tr ng-repeat="b in vm.bookings track by b._id">
              <td>{{ b.room.roomNumber }} ({{ b.room.type }})</td>
              <td>{{ b.checkInDate | date:'mediumDate' }} - {{ b.checkOutDate | date:'mediumDate' }}</td>
              <td><span class="badge bg-secondary">{{ b.status }}</span></td>
              <td>
                <div class="small">Nights: {{ b.nights || '-' }}</div>
                <div class="small">Subtotal: Rs {{ b.subtotal || b.totalPrice }}</div>
                <div class="small">Tax (12%): Rs {{ b.taxAmount || 0 }}</div>
                <div class="small">Service (5%): Rs {{ b.serviceFee || 0 }}</div>
                <div class="small" ng-if="b.discountAmount > 0">Discount{{ b.couponCode ? ' (' + b.couponCode + ')' : '' }}: - Rs {{ b.discountAmount }}</div>
                <div class="fw-semibold">Total: Rs {{ b.totalPrice }}</div>
              </td>
              <td><button class="btn btn-outline-danger btn-sm" ng-if="b.status === 'confirmed'" ng-click="vm.cancel(b._id)">Cancel</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function adminTemplate() {
  return `
    <section class="row g-3 mb-3">
      <div class="col-md-3"><div class="card ui-card p-3 admin-stat"><p class="small mb-1">Users</p><h4>{{ vm.report.totalUsers || 0 }}</h4></div></div>
      <div class="col-md-3"><div class="card ui-card p-3 admin-stat"><p class="small mb-1">Rooms</p><h4>{{ vm.report.totalRooms || 0 }}</h4></div></div>
      <div class="col-md-3"><div class="card ui-card p-3 admin-stat"><p class="small mb-1">Bookings</p><h4>{{ vm.report.totalBookings || 0 }}</h4></div></div>
      <div class="col-md-3"><div class="card ui-card p-3 admin-stat"><p class="small mb-1">Revenue</p><h4>Rs {{ vm.report.totalRevenue || 0 }}</h4></div></div>
    </section>

    <section class="card ui-card p-4 admin-panel mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 class="mb-0">Add New Room</h4>
          <p class="small text-muted mb-0">Create a polished inventory for BluePeak Hotel.</p>
        </div>
        <span class="badge text-bg-primary">Admin Controls</span>
      </div>
      <p class="text-danger">{{ vm.message }}</p>
      <form class="row g-3" ng-submit="vm.addRoom()">
        <div class="col-md-3"><label class="form-label small">Room Number</label><input class="form-control" placeholder="B-203" ng-model="vm.newRoom.roomNumber" required /></div>
        <div class="col-md-3"><label class="form-label small">Room Type</label><select class="form-select" ng-model="vm.newRoom.type"><option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="suite">Suite</option></select></div>
        <div class="col-md-3"><label class="form-label small">Price / Night</label><input type="number" class="form-control" placeholder="1800" ng-model="vm.newRoom.pricePerNight" required /></div>
        <div class="col-md-3"><label class="form-label small">Capacity</label><input type="number" class="form-control" placeholder="2" ng-model="vm.newRoom.capacity" required /></div>
        <div class="col-md-12"><label class="form-label small">Image URL</label><input class="form-control" placeholder="https://..." ng-model="vm.newRoom.imageUrl" required /></div>
        <div class="col-md-12 d-flex justify-content-end"><button class="btn btn-primary px-4">Add Room</button></div>
      </form>
    </section>

    <section class="card ui-card p-3 admin-panel">
      <h5 class="mb-3">Current Room Inventory</h5>
      <div class="table-responsive">
        <table class="table align-middle table-hover">
          <thead><tr><th>Room</th><th>Type</th><th>Price/Night</th><th>Capacity</th><th></th></tr></thead>
          <tbody>
            <tr ng-repeat="r in vm.rooms track by r._id">
              <td><strong>{{ r.roomNumber }}</strong></td>
              <td><span class="badge text-bg-light border">{{ r.type }}</span></td>
              <td>Rs {{ r.pricePerNight }}</td>
              <td>{{ r.capacity }} guest(s)</td>
              <td class="text-end"><button class="btn btn-sm btn-outline-danger" ng-click="vm.deleteRoom(r._id)">Delete</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card ui-card p-3 admin-panel mt-3">
      <h5 class="mb-3">Contact Messages</h5>
      <p class="text-danger mb-2" ng-if="vm.contactError">{{ vm.contactError }}</p>
      <div class="table-responsive" ng-if="vm.contactMessages.length">
        <table class="table align-middle table-hover">
          <thead><tr><th>Name</th><th>Email</th><th>Message</th><th>Received</th></tr></thead>
          <tbody>
            <tr ng-repeat="m in vm.contactMessages track by m._id">
              <td><strong>{{ m.name }}</strong></td>
              <td>{{ m.email }}</td>
              <td class="small">{{ m.message }}</td>
              <td>{{ m.createdAt | date:'medium' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-muted mb-0" ng-if="!vm.contactMessages.length">No contact messages yet.</p>
    </section>
  `;
}

function contactTemplate() {
  return `
    <section class="card ui-card p-4 mb-3">
      <div class="row g-4">
        <div class="col-lg-6">
          <p class="eyebrow text-primary mb-2">GET IN TOUCH</p>
          <h3 class="mb-3">Contact BluePeak Hotel</h3>
          <p class="text-muted mb-4">
            Need help with bookings, room details, or custom group stays? Our team is available 24 x 7.
          </p>

          <div class="contact-info-list">
            <div class="contact-info-item">
              <h6 class="mb-1">Phone</h6>
              <p class="mb-0">+91 98765 43210</p>
            </div>
            <div class="contact-info-item">
              <h6 class="mb-1">Email</h6>
              <p class="mb-0">support@bluepeakhotel.com</p>
            </div>
            <div class="contact-info-item">
              <h6 class="mb-1">Address</h6>
              <p class="mb-0">BluePeak Hotel, City Center Road, New Delhi, India</p>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="contact-form-wrap">
            <h5 class="mb-3">Send us a message</h5>
            <p class="text-danger mb-2" ng-if="vm.error">{{ vm.error }}</p>
            <p class="text-success mb-2" ng-if="vm.success">{{ vm.success }}</p>
            <form ng-submit="vm.submit()">
              <div class="mb-3">
                <label class="form-label">Full Name</label>
                <input class="form-control" type="text" placeholder="Your name" ng-model="vm.form.name" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input class="form-control" type="email" placeholder="you@example.com" ng-model="vm.form.email" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Message</label>
                <textarea class="form-control" rows="4" placeholder="How can we help?" ng-model="vm.form.message" required minlength="10"></textarea>
              </div>
              <button type="submit" class="btn btn-primary w-100" ng-disabled="vm.submitting">
                {{ vm.submitting ? 'Sending...' : 'Send Message' }}
              </button>
              <p class="small text-muted mt-2 mb-0">Messages are submitted securely to the BluePeak backend.</p>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}
