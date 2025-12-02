import React from 'react';

interface MaterialIconProps {
  name: string;
  size?: number;   // 👈 THÊM DÒNG NÀY
  className?: string;
}

const MaterialIcon: React.FC<MaterialIconProps> = ({ name, className = '' }) => {
  return (
    <span className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
};

export default MaterialIcon;
