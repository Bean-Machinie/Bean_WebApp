import { ReactNode, useState } from 'react';

type ProfileMenuItem = {
  id: string;
  title: string;
  icon: ReactNode;
};

type ProfileMenuProps = {
  isCollapsed: boolean;
  items: ProfileMenuItem[];
  activeItemId?: string;
  onSelect: (itemId: string) => void;
};

// ProfileMenu renders the avatar row and its upward dropdown.
// Replace `User Name` and the circle avatar with real profile data when available.
function ProfileMenu({ isCollapsed, items, activeItemId, onSelect }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => setIsOpen((prev) => !prev);
  const handleSelect = (itemId: string) => {
    onSelect(itemId);
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
          const isActive = item.id === activeItemId;
          return (
            <li key={item.id} role="menuitem">
              <button
                className={`profile-menu__item ${isActive ? 'profile-menu__item--active' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                <span className="profile-menu__item-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="profile-menu__item-label">
                  {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ProfileMenu;
