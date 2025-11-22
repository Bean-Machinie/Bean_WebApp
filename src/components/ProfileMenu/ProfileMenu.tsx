import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type ProfileMenuItem = {
  id: string;
  title: string;
  icon: ReactNode;
};

type ProfileMenuProps = {
  isCollapsed: boolean;
  items: ProfileMenuItem[];
};

// ProfileMenu renders the avatar row and its upward dropdown.
// Replace `User Name` and the circle avatar with real profile data when available.
function ProfileMenu({ isCollapsed, items }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleToggle = () => setIsOpen((prev) => !prev);
  const handleSelect = (itemId: string) => {
    const destinations: Record<string, string> = {
      profile: '/settings/profile',
      themes: '/settings/appearance',
      settings: '/settings',
    };

    navigate(destinations[itemId] ?? '/settings');
    setIsOpen(false);
  };

  return (
    <div className="profile-menu">
      <button
        className="profile-menu__trigger"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div className="profile-menu__avatar" aria-hidden />
        <span
          className={`profile-menu__name ${isCollapsed ? 'profile-menu__name--hidden' : ''}`}
          title="User Name"
        >
          User Name
        </span>
      </button>

      <ul className={`profile-menu__dropdown ${isOpen ? 'profile-menu__dropdown--open' : ''}`} role="menu">
        {items.map((item) => {
          return (
            <li key={item.id} role="menuitem">
              <button className="profile-menu__item" onClick={() => handleSelect(item.id)}>
                <span className="profile-menu__item-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="profile-menu__item-label">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ProfileMenu;
