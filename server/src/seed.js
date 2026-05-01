require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Room = require("./models/Room");
const Booking = require("./models/Booking");

async function seed() {
  await connectDB();

  await Promise.all([User.deleteMany({}), Room.deleteMany({}), Booking.deleteMany({})]);

  const [admin, user] = await User.create([
    {
      name: "Hostel Admin",
      email: "admin@bluepeakhostel.com",
      password: "Admin@123",
      role: "admin",
    },
    {
      name: "Demo Guest",
      email: "guest@example.com",
      password: "Guest@123",
      role: "user",
    },
  ]);

  const rooms = await Room.create([
    {
      roomNumber: "A-101",
      type: "standard",
      pricePerNight: 799,
      capacity: 1,
      amenities: ["Free Wi-Fi", "Locker", "Shared Bath"],
      imageUrl:
        "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=80",
    },
    {
      roomNumber: "A-102",
      type: "standard",
      pricePerNight: 1199,
      capacity: 2,
      amenities: ["Wi-Fi", "Work Desk", "Private Bath"],
      imageUrl:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    },
    {
      roomNumber: "B-201",
      type: "deluxe",
      pricePerNight: 1899,
      capacity: 3,
      amenities: ["AC", "Wi-Fi", "Balcony", "Private Bath"],
      imageUrl:
        "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=900&q=80",
    },
    {
      roomNumber: "B-202",
      type: "deluxe",
      pricePerNight: 2099,
      capacity: 4,
      amenities: ["AC", "Wi-Fi", "Queen Bed", "Breakfast"],
      imageUrl:
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80",
    },
    {
      roomNumber: "C-301",
      type: "suite",
      pricePerNight: 2999,
      capacity: 4,
      amenities: ["AC", "Premium View", "Private Lounge", "Breakfast"],
      imageUrl:
        "https://images.unsplash.com/photo-1590490359683-658d3d23f972?auto=format&fit=crop&w=900&q=80",
    },
    {
      roomNumber: "C-302",
      type: "suite",
      pricePerNight: 3599,
      capacity: 6,
      amenities: ["Family Suite", "Mini Kitchen", "AC", "Breakfast"],
      imageUrl:
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80",
    },
  ]);

  await Booking.create([
    {
      user: user._id,
      room: rooms[1]._id,
      checkInDate: new Date("2026-05-05"),
      checkOutDate: new Date("2026-05-08"),
      guests: 2,
      totalPrice: 1199 * 3,
      status: "confirmed",
    },
    {
      user: user._id,
      room: rooms[4]._id,
      checkInDate: new Date("2026-05-10"),
      checkOutDate: new Date("2026-05-13"),
      guests: 3,
      totalPrice: 2999 * 3,
      status: "confirmed",
    },
  ]);

  console.log("Seed completed.");
  console.log("Admin login: admin@bluepeakhostel.com / Admin@123");
  console.log("User login: guest@example.com / Guest@123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
