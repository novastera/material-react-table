import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { debounce } from '@mui/material/utils';
import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { parseFromValuesOrFunc, resolveSlotProps } from '../../utils/utils';
import { MRT_FilterOptionMenu } from '../menus/MRT_FilterOptionMenu';

export interface MRT_GlobalFilterTextFieldProps<TData extends MRT_RowData>
  extends TextFieldProps<'standard'> {
  table: MRT_TableInstance<TData>;
}

export const MRT_GlobalFilterTextField = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_GlobalFilterTextFieldProps<TData>) => {
  const {
    getState,
    options: {
      enableGlobalFilterModes,
      icons: { CloseIcon, SearchIcon },
      localization,
      manualFiltering,
      muiSearchTextFieldProps,
    },
    refs: { searchInputRef },
    setGlobalFilter,
  } = table;
  const { globalFilter, showGlobalFilter } = getState();

  const {
    InputProps: muiInputProps,
    inputProps: muiHtmlInputProps,
    slotProps: muiSlotProps,
    ...textFieldProps
  } = {
    ...parseFromValuesOrFunc(muiSearchTextFieldProps, {
      table,
    }),
    ...rest,
  } as any;

  const isMounted = useRef(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(globalFilter ?? '');

  const handleChangeDebounced = useCallback(
    debounce(
      (event: ChangeEvent<HTMLInputElement>) => {
        setGlobalFilter(event.target.value ?? undefined);
      },
      manualFiltering ? 500 : 250,
    ),
    [],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
    handleChangeDebounced(event);
    (textFieldProps as any)?.onChange?.(event);
  };

  const handleGlobalFilterMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClear = () => {
    setSearchValue('');
    setGlobalFilter(undefined);
  };

  useEffect(() => {
    if (isMounted.current) {
      setSearchValue(globalFilter ?? '');
    }
    isMounted.current = true;
  }, [globalFilter]);

  return (
    <Collapse in={showGlobalFilter} orientation="horizontal">
      <TextField
        fullWidth
        margin="none"
        placeholder={localization.search}
        variant="standard"
        {...textFieldProps}
        slotProps={{
          ...muiSlotProps,
          htmlInput: (ownerState: any) =>
            resolveSlotProps(
              muiSlotProps?.htmlInput,
              { autoComplete: 'off', ...muiHtmlInputProps },
              ownerState,
            ),
          input: (ownerState: any) =>
            resolveSlotProps(
              muiSlotProps?.input,
              {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={localization.clearSearch ?? ''}>
                      <span>
                        <IconButton
                          aria-label={localization.clearSearch}
                          disabled={!searchValue?.length}
                          onClick={handleClear}
                          size="small"
                        >
                          <CloseIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
                startAdornment: enableGlobalFilterModes ? (
                  <InputAdornment position="start">
                    <Tooltip title={localization.changeSearchMode}>
                      <IconButton
                        aria-label={localization.changeSearchMode}
                        onClick={handleGlobalFilterMenuOpen}
                        size="small"
                        sx={{ height: '1.75rem', width: '1.75rem' }}
                      >
                        <SearchIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ) : (
                  <SearchIcon style={{ marginRight: '4px' }} />
                ),
                sx: { mb: 0 },
                ...muiInputProps,
              },
              ownerState,
            ),
        }}
        inputRef={(inputRef) => {
          searchInputRef.current = inputRef;
          if ((textFieldProps as any)?.inputRef) {
            (textFieldProps as any).inputRef = inputRef;
          }
        }}
        onChange={handleChange}
        value={searchValue ?? ''}
      />
      <MRT_FilterOptionMenu
        anchorEl={anchorEl}
        onSelect={handleClear}
        setAnchorEl={setAnchorEl}
        table={table}
      />
    </Collapse>
  );
};
