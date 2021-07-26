function shapeOfArray() {
  
}

export function shape(data: any) {
  if (Array.isArray()) {
    shapeOfArray(data as any[]);
  }
}
