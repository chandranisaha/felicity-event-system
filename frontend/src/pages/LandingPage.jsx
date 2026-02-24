import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <main className="page landing-page">
      <section className="landing-hero">
        <div className="landing-center">
          <img src="/logo.png" alt="Felicity 2026 Logo" className="landing-logo large" />
          <h1>Felicity 2026</h1>
          <p className="landing-subtitle">The Disco Edition</p>
          <p className="landing-lead">
            Three days of music, dance, hacking, sports, workshops, showcases, and high-energy campus culture. Register for events, track tickets with QR,
            join live forums, and experience the full fest from one portal.
          </p>
          <div className="landing-meta">
            <div className="meta-chip">March 20 - March 22, 2026</div>
            <div className="meta-chip">Venue : IIIT Hyderabad Campus</div>
            <div className="meta-chip">Cultural | Technical | Sports</div>
          </div>
          <div className="row center-row">
            <Link to="/events/browse" className="link-btn">
              Explore Events
            </Link>
            <Link to="/login" className="link-btn accent-blue">
              Login
            </Link>
            <Link to="/register" className="link-btn accent-pink">
              Register
            </Link>
          </div>
        </div>
      </section>

      <section className="card landing-section">
        <h2>What You Can Do</h2>
        <div className="grid">
          <div className="inline-box">
            <h3>Register and Track</h3>
            <p>Register for normal events and merchandise events, view participation history, and open ticket QR instantly.</p>
          </div>
          <div className="inline-box">
            <h3>Forum and Notifications</h3>
            <p>Get event updates, announcements, and in-app notifications from organizers during ongoing events.</p>
          </div>
          <div className="inline-box">
            <h3>Club Discovery</h3>
            <p>Follow clubs, filter events by interests, and personalize your dashboard and recommendations.</p>
          </div>
        </div>
      </section>

      <section className="card landing-section">
        <h2>Fest Highlights</h2>
        <div className="landing-timeline">
          <div className="inline-box">Day 1: Opening Show + Street Battle + Club Expos</div>
          <div className="inline-box">Day 2: Hackathon Kickoff + Workshops + Music Night</div>
          <div className="inline-box">Day 3: Finals + Prize Ceremony + Closing Concert</div>
        </div>
      </section>

      <section className="card landing-section">
        <h2>Get Started</h2>
        <div className="row center-row">
          <Link to="/events/browse" className="link-btn">
            Browse Public Events
          </Link>
          <Link to="/clubs" className="link-btn accent-blue">
            Explore Clubs
          </Link>
          <Link to="/register" className="link-btn accent-pink">
            Create Participant Account
          </Link>
        </div>
        <p className="muted">Organizer and Admin accounts are provisioned securely by Admin workflow.</p>
      </section>
    </main>
  );
};

export default LandingPage;
