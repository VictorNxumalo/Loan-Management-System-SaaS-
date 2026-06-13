'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function KycProfileFields({
  idNumber,
  address,
  phone,
  showPhone,
  onIdNumberChange,
  onAddressChange,
  onPhoneChange,
  errors,
  disabled,
}: {
  idNumber: string;
  address: string;
  phone?: string;
  showPhone?: boolean;
  onIdNumberChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPhoneChange?: (value: string) => void;
  errors?: { idNumber?: string; address?: string; phone?: string };
  disabled?: boolean;
}) {
  return (
    <>
      {showPhone && (
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={phone ?? ''}
            disabled={disabled}
            onChange={(e) => onPhoneChange?.(e.target.value)}
          />
          {errors?.phone && (
            <p className="text-sm text-destructive">{errors.phone}</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="idNumber">SA ID number</Label>
        <Input
          id="idNumber"
          inputMode="numeric"
          maxLength={13}
          placeholder="13 digits"
          value={idNumber}
          disabled={disabled}
          onChange={(e) => onIdNumberChange(e.target.value.replace(/\D/g, '').slice(0, 13))}
        />
        {errors?.idNumber && (
          <p className="text-sm text-destructive">{errors.idNumber}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Physical address</Label>
        <Input
          id="address"
          value={address}
          disabled={disabled}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Street, suburb, city, postal code"
        />
        {errors?.address && (
          <p className="text-sm text-destructive">{errors.address}</p>
        )}
      </div>
    </>
  );
}

export function BankDetailsFields({
  accountHolder,
  bankName,
  branchCode,
  accountNumber,
  onAccountHolderChange,
  onBankNameChange,
  onBranchCodeChange,
  onAccountNumberChange,
  errors,
  disabled,
  accountNumberPlaceholder,
}: {
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  onAccountHolderChange: (value: string) => void;
  onBankNameChange: (value: string) => void;
  onBranchCodeChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  errors?: Record<string, string | undefined>;
  disabled?: boolean;
  accountNumberPlaceholder?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="accountHolder">Account holder</Label>
        <Input
          id="accountHolder"
          value={accountHolder}
          disabled={disabled}
          onChange={(e) => onAccountHolderChange(e.target.value)}
        />
        {errors?.accountHolder && (
          <p className="text-sm text-destructive">{errors.accountHolder}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="bankName">Bank name</Label>
        <Input
          id="bankName"
          value={bankName}
          disabled={disabled}
          onChange={(e) => onBankNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="branchCode">Branch code</Label>
        <Input
          id="branchCode"
          value={branchCode}
          disabled={disabled}
          maxLength={6}
          onChange={(e) => onBranchCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {errors?.branchCode && (
          <p className="text-sm text-destructive">{errors.branchCode}</p>
        )}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="accountNumber">Account number</Label>
        <Input
          id="accountNumber"
          value={accountNumber}
          disabled={disabled}
          placeholder={accountNumberPlaceholder ?? '6–20 digits'}
          onChange={(e) =>
            onAccountNumberChange(e.target.value.replace(/\D/g, '').slice(0, 20))
          }
        />
        {errors?.accountNumber && (
          <p className="text-sm text-destructive">{errors.accountNumber}</p>
        )}
      </div>
    </div>
  );
}
