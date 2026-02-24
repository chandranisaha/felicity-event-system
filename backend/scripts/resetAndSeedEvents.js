const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Organizer = require("../models/Organizer");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const now = new Date();

const daysFromNow = (days, hour = 10) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const organizersSeed = [
  {
    name: "Dance Club",
    category: "Cultural",
    description: "iiit dance community running choreography and performance events",
    contactEmail: "dance-club@clubs.iiit.ac.in",
    password: "DanceClub@123",
  },
  {
    name: "Hacking Club",
    category: "Technical",
    description: "organizes hackathons, security workshops and coding contests",
    contactEmail: "hacking-club@clubs.iiit.ac.in",
    password: "HackingClub@123",
  },
  {
    name: "Robotics Club",
    category: "Technical",
    description: "robotics builds, autonomous systems and embedded workshops",
    contactEmail: "robotics-club@clubs.iiit.ac.in",
    password: "RoboticsClub@123",
  },
  {
    name: "Photography Club",
    category: "Cultural",
    description: "photo walks, editing sessions and visual storytelling",
    contactEmail: "photo-club@clubs.iiit.ac.in",
    password: "PhotoClub@123",
  },
  {
    name: "Sports Council",
    category: "Sports",
    description: "runs sports leagues and fitness challenges across campus",
    contactEmail: "sports-council@clubs.iiit.ac.in",
    password: "SportsCouncil@123",
  },
  {
    name: "Music Club",
    category: "Cultural",
    description: "live music performances, jam nights and band competitions",
    contactEmail: "music-club@clubs.iiit.ac.in",
    password: "MusicClub@123",
  },
  {
    name: "Drama Club",
    category: "Cultural",
    description: "street plays, theatre workshops and stage productions",
    contactEmail: "drama-club@clubs.iiit.ac.in",
    password: "DramaClub@123",
  },
  {
    name: "Design Club",
    category: "Technical",
    description: "ui/ux, branding and visual systems for campus projects",
    contactEmail: "design-club@clubs.iiit.ac.in",
    password: "DesignClub@123",
  },
];

const buildEvents = (organizers) => {
  const findOrg = (name) => organizers.find((item) => item.name === name);

  return [
    {
      name: "Spring Street Battle 2026",
      description: "solo dance battle with knockout rounds and final stage showdown",
      coverImage: "https://picsum.photos/id/1035/1200/600",
      eventType: "Normal",
      eligibility: "all",
      registrationDeadline: daysFromNow(-16, 23),
      startDate: daysFromNow(-14, 17),
      endDate: daysFromNow(-14, 21),
      registrationLimit: 180,
      registrationFee: 100,
      organizer: findOrg("Dance Club")._id,
      tags: ["Cultural", "Dance", "Performance"],
      status: "Published",
      formFields: [
        { label: "Dance Style", type: "dropdown", required: true, options: ["Hip-hop", "Contemporary", "Classical"], order: 0 },
        { label: "Years of Experience", type: "text", required: true, options: [], order: 1 },
      ],
    },
    {
      name: "Hack Night 48",
      description: "48-hour product hack focused on campus utility tools",
      coverImage: "https://picsum.photos/id/180/1200/600",
      eventType: "Normal",
      eligibility: "iiit",
      registrationDeadline: daysFromNow(-2, 23),
      startDate: daysFromNow(-1, 9),
      endDate: daysFromNow(1, 20),
      registrationLimit: 300,
      registrationFee: 0,
      organizer: findOrg("Hacking Club")._id,
      tags: ["Technical", "Coding", "Hackathon"],
      status: "Published",
      formFields: [
        { label: "GitHub Profile", type: "text", required: true, options: [], order: 0 },
        { label: "Preferred Domain", type: "dropdown", required: true, options: ["Web", "AI/ML", "Systems", "Cybersecurity"], order: 1 },
      ],
    },
    {
      name: "Capture Campus: Photo Walk",
      description: "guided photo walk with live composition and editing feedback",
      coverImage: "https://picsum.photos/id/1025/1200/600",
      eventType: "Normal",
      eligibility: "all",
      registrationDeadline: daysFromNow(3, 23),
      startDate: daysFromNow(5, 7),
      endDate: daysFromNow(5, 11),
      registrationLimit: 120,
      registrationFee: 50,
      organizer: findOrg("Photography Club")._id,
      tags: ["Cultural", "Photography", "Workshop"],
      status: "Published",
      formFields: [
        { label: "Camera Type", type: "dropdown", required: true, options: ["Phone", "DSLR", "Mirrorless"], order: 0 },
        { label: "Portfolio URL", type: "file", required: false, options: [], order: 1 },
      ],
    },
    {
      name: "RoboRush Build Sprint",
      description: "rapid robotics challenge from idea to demo in one day",
      coverImage: "https://picsum.photos/id/1076/1200/600",
      eventType: "Normal",
      eligibility: "iiit",
      registrationDeadline: daysFromNow(8, 23),
      startDate: daysFromNow(10, 9),
      endDate: daysFromNow(10, 18),
      registrationLimit: 100,
      registrationFee: 150,
      organizer: findOrg("Robotics Club")._id,
      tags: ["Technical", "Robotics", "Hardware"],
      status: "Published",
      formFields: [
        { label: "Prior Robotics Experience", type: "checkbox", required: false, options: [], order: 0 },
        { label: "Primary Skill", type: "dropdown", required: true, options: ["CAD", "Electronics", "Programming"], order: 1 },
      ],
    },
    {
      name: "Felicity Club Tee Drop",
      description: "official fest t-shirt sale with multiple sizes and colors",
      coverImage: "https://picsum.photos/id/1062/1200/600",
      eventType: "Merchandise",
      eligibility: "all",
      registrationDeadline: daysFromNow(12, 23),
      startDate: daysFromNow(13, 10),
      endDate: daysFromNow(20, 18),
      registrationLimit: 500,
      registrationFee: 699,
      organizer: findOrg("Sports Council")._id,
      tags: ["Merchandise", "Tshirt", "Felicity"],
      status: "Published",
      merchandiseConfig: {
        purchaseLimitPerUser: 3,
        allowCancellation: true,
        variants: [
          { name: "Felicity Tee", size: "M", color: "Black", stock: 120, remainingStock: 120 },
          { name: "Felicity Tee", size: "L", color: "Black", stock: 120, remainingStock: 120 },
          { name: "Felicity Tee", size: "XL", color: "Maroon", stock: 80, remainingStock: 80 },
        ],
      },
    },
    {
      name: "Hack Club Hoodie Sale",
      description: "limited club hoodies for winter coding nights",
      coverImage: "https://picsum.photos/id/1080/1200/600",
      eventType: "Merchandise",
      eligibility: "iiit",
      registrationDeadline: daysFromNow(6, 23),
      startDate: daysFromNow(7, 11),
      endDate: daysFromNow(15, 20),
      registrationLimit: 250,
      registrationFee: 1299,
      organizer: findOrg("Hacking Club")._id,
      tags: ["Merchandise", "Hoodie", "Technical"],
      status: "Published",
      merchandiseConfig: {
        purchaseLimitPerUser: 2,
        allowCancellation: false,
        variants: [
          { name: "Hack Hoodie", size: "M", color: "Navy", stock: 70, remainingStock: 70 },
          { name: "Hack Hoodie", size: "L", color: "Navy", stock: 70, remainingStock: 70 },
        ],
      },
    },
    {
      name: "Beat Drop Live Night",
      description: "high-energy live music with campus bands and guest artists",
      coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
      eventType: "Normal",
      eligibility: "all",
      registrationDeadline: daysFromNow(1, 22),
      startDate: daysFromNow(2, 19),
      endDate: daysFromNow(2, 23),
      registrationLimit: 350,
      registrationFee: 199,
      organizer: findOrg("Music Club")._id,
      tags: ["Cultural", "Music", "Live"],
      status: "Published",
      formFields: [{ label: "Preferred Genre", type: "dropdown", required: false, options: ["EDM", "Rock", "Bollywood", "Indie"], order: 0 }],
    },
    {
      name: "Midnight Theatre Circuit",
      description: "interactive theatre performances and improv battles",
      coverImage: "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&w=1400&q=80",
      eventType: "Normal",
      eligibility: "all",
      registrationDeadline: daysFromNow(4, 20),
      startDate: daysFromNow(6, 18),
      endDate: daysFromNow(6, 22),
      registrationLimit: 220,
      registrationFee: 99,
      organizer: findOrg("Drama Club")._id,
      tags: ["Cultural", "Theatre", "Performance"],
      status: "Published",
      formFields: [{ label: "Previous Stage Experience", type: "checkbox", required: false, options: [], order: 0 }],
    },
    {
      name: "Design Sprint Arena",
      description: "product design sprint focused on event and campus experience",
      coverImage: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1400&q=80",
      eventType: "Normal",
      eligibility: "iiit",
      registrationDeadline: daysFromNow(5, 23),
      startDate: daysFromNow(7, 10),
      endDate: daysFromNow(7, 18),
      registrationLimit: 140,
      registrationFee: 149,
      organizer: findOrg("Design Club")._id,
      tags: ["Technical", "Design", "UX"],
      status: "Published",
      formFields: [{ label: "Portfolio URL", type: "file", required: false, options: [], order: 0 }],
    },
    {
      name: "Sports Council Jersey Sale",
      description: "official jerseys with custom size and color options",
      coverImage: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1400&q=80",
      eventType: "Merchandise",
      eligibility: "all",
      registrationDeadline: daysFromNow(9, 23),
      startDate: daysFromNow(10, 9),
      endDate: daysFromNow(16, 22),
      registrationLimit: 400,
      registrationFee: 899,
      organizer: findOrg("Sports Council")._id,
      tags: ["Merchandise", "Sports", "Jersey"],
      status: "Published",
      merchandiseConfig: {
        purchaseLimitPerUser: 2,
        allowCancellation: true,
        variants: [
          { name: "Sports Jersey", size: "M", color: "Blue", stock: 90, remainingStock: 90 },
          { name: "Sports Jersey", size: "L", color: "Blue", stock: 90, remainingStock: 90 },
          { name: "Sports Jersey", size: "XL", color: "Black", stock: 70, remainingStock: 70 },
        ],
      },
    },
  ];
};

const run = async () => {
  await connectDB();

  await Ticket.deleteMany({});
  await Event.deleteMany({});

  const organizers = [];
  for (const seed of organizersSeed) {
    let organizer = await Organizer.findOne({ contactEmail: seed.contactEmail });
    if (!organizer) {
      organizer = await Organizer.create(seed);
    }
    if (!organizer.isActive) {
      organizer.isActive = true;
      await organizer.save();
    }
    organizers.push(organizer);
  }

  const events = buildEvents(organizers);
  await Event.insertMany(events);

  console.log(`seed complete: cleared events+tickets and created ${events.length} events`);
  process.exit(0);
};

run().catch((error) => {
  console.error("seed failed", error.message);
  process.exit(1);
});
