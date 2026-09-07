import { createContext, useContext, type Dispatch } from 'react';
import type { Action } from './actions';

export const DispatchContext = createContext<Dispatch<Action>>(() => {});

export function useDispatch(): Dispatch<Action> {
  return useContext(DispatchContext);
}
