import React from 'react';
import { GenericDetails, GenericDetailsProps } from './GenericDetails';

export function ClickhouseDetails(props: GenericDetailsProps) {
  return <GenericDetails {...props} skipDatabase />;
}
