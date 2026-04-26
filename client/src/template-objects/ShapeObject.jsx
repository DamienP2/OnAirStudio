import React from 'react';

export default function ShapeObject({ width, height, props }) {
  const isCircle = props.type === 'circle';
  const style = {
    width, height,
    background: props.fillColor ?? '#FFFFFF',
    border: (props.strokeWidth ?? 0) > 0 ? `${props.strokeWidth}px solid ${props.strokeColor || '#000000'}` : 'none',
    borderRadius: isCircle ? '50%' : (props.borderRadius ?? 0),
    opacity: props.opacity ?? 1,
    boxSizing: 'border-box'
  };
  return <div style={style} />;
}
