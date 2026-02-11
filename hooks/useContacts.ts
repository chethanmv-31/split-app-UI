import { useState, useEffect } from 'react';
import * as Contacts from 'expo-contacts';

export interface Contact {
    id: string;
    name: string;
    phoneNumber?: string;
    isContact: true;
}

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        requestPermissionAndFetchContacts();
    }, []);

    const requestPermissionAndFetchContacts = async () => {
        try {
            setLoading(true);
            const { status } = await Contacts.requestPermissionsAsync();
            setHasPermission(status === 'granted');

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                });

                if (data.length > 0) {
                    const formattedContacts: Contact[] = data
                        .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
                        .map(contact => ({
                            id: contact.id,
                            name: contact.name || 'Unknown',
                            phoneNumber: contact.phoneNumbers?.[0]?.number?.replace(/\s/g, ''),
                            isContact: true as const,
                        }));

                    setContacts(formattedContacts);
                }
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        contacts,
        hasPermission,
        loading,
        requestPermission: requestPermissionAndFetchContacts,
    };
}
