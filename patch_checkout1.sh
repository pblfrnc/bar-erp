sed -i '' -e 's/Tag,/Tag, BookDown,/' client/src/components/CheckoutModal.tsx
sed -i '' -e '/const \[paymentSuccess, setPaymentSuccess\] = useState<boolean>(false);/a\
  const [customers, setCustomers] = useState<any[]>([]);\
  const [customerId, setCustomerId] = useState<string>('"'"'"'"');\
  const [customerNameInput, setCustomerNameInput] = useState<string>('"'"'"'"');\
\
  React.useEffect(() => {\
    if (isManager) {\
      api.getCustomers().then(setCustomers).catch(() => {});\
    }\
  }, [isManager]);\
' client/src/components/CheckoutModal.tsx
