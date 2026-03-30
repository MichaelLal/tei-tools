import logo from "./logo.jpg";


const Navbar = ({ show, closeNav, activeTab, setActiveTab }) => {
  return (
    <div className={show ? "sidenav active" : "sidenav"}>
      <img src={logo} alt="logo" className="logo" />

      <ul>
        <li>
          <a
            className={activeTab === 'tutorial' ? 'active' : ''}
            onClick={() => { setActiveTab('tutorial'); closeNav(); }}
          >
            Tutorial
          </a>
        </li>

        <li>
          <a
            className={activeTab === 'tagging' ? 'active' : ''}
            onClick={() => { setActiveTab('tagging'); closeNav(); }}
          >
            Tagging
          </a>
        </li>
        <li className="nav-divider"></li>
        <li>
          <a
            className={activeTab === 'add-tag' ? 'active' : ''}
            onClick={() => { setActiveTab('add-tag'); closeNav(); }}
          >
            + Create Tag
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Navbar;
