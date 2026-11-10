import { useState } from 'react';
import { BlockStack, Modal, Select, Text, TextField } from '@shopify/polaris';
import type { KitSize, Variant } from '../domain/types';

interface Props {
  readonly open: boolean;
  readonly existing: readonly Variant[];
  readonly onClose: () => void;
  readonly onCreate: (kit: Variant) => void;
}

export function CreateKitModal({ open, existing, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<'6' | '12'>('6');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');

  const trimmedSku = sku.trim();
  const error = !title.trim()
    ? 'Enter a title.'
    : !trimmedSku
      ? 'Enter a SKU.'
      : existing.some((v) => v.sku.toLowerCase() === trimmedSku.toLowerCase())
        ? 'That SKU is already in use.'
        : undefined;

  const create = () => {
    if (error) return;
    onCreate({
      id: `v-kit-${trimmedSku.toLowerCase()}`,
      title: title.trim(),
      sku: trimmedSku,
      barcode: barcode.trim(),
      collectionIds: [],
      kitSize: Number(size) as KitSize,
    });
    setTitle('');
    setSku('');
    setBarcode('');
    setSize('6');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a new kit"
      primaryAction={{ content: 'Create kit', onAction: create, disabled: Boolean(error) }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued">
            In the real app this creates a Shopify product with tracked inventory. The kit's contents are chosen each time you assemble.
          </Text>
          <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" />
          <Select
            label="Kit size"
            options={[{ label: '6 mini bars', value: '6' }, { label: '12 mini bars', value: '12' }]}
            value={size}
            onChange={(v) => setSize(v === '12' ? '12' : '6')}
          />
          <TextField label="SKU" value={sku} onChange={setSku} autoComplete="off" error={sku && error ? error : undefined} />
          <TextField label="Barcode (optional)" value={barcode} onChange={setBarcode} autoComplete="off" />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
