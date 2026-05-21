import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-gray-800">
      <div className="mb-8">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-500">
          ← Retour
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">
        Politique de confidentialité
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <Section title="1. Responsable du traitement">
        <p>
          Le présent site, <strong>ManyOPlan</strong>, est édité par{" "}
          <em>[À COMPLÉTER : nom de l'éditeur / association]</em>, dont le contact
          pour toute question relative à vos données est{" "}
          <em>[À COMPLÉTER : email de contact RGPD]</em>.
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons et traitons les catégories de données suivantes :</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>
            <strong>Identification</strong> : prénom, nom, surnom, email, mot de
            passe (haché)
          </li>
          <li>
            <strong>Activité</strong> : adhésions à des associations et événements,
            affectations à des créneaux (dates, statut)
          </li>
          <li>
            <strong>Communications</strong> : messages privés envoyés et reçus via
            la messagerie interne
          </li>
          <li>
            <strong>Contenus publiés</strong> : actualités, photos d'événements,
            logos d'association
          </li>
          <li>
            <strong>Données techniques</strong> : dates de connexion, jetons
            d'authentification
          </li>
        </ul>
      </Section>

      <Section title="3. Finalités et bases légales">
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>
            <strong>Gestion du compte et des affectations</strong> — exécution du
            contrat de bénévolat (art. 6.1.b RGPD)
          </li>
          <li>
            <strong>Communication interne</strong> (messagerie, actualités) —
            intérêt légitime de l'association à coordonner ses bénévoles
            (art. 6.1.f)
          </li>
          <li>
            <strong>Sécurité et journalisation</strong> — obligation légale et
            intérêt légitime
          </li>
          <li>
            <strong>Publication de photos d'événements</strong> — consentement
            explicite (art. 6.1.a) et droit à l'image
          </li>
        </ul>
      </Section>

      <Section title="4. Destinataires">
        <p>
          Vos données sont accessibles aux administrateurs des associations et
          événements auxquels vous appartenez. Elles ne sont jamais cédées ni
          vendues à des tiers.
        </p>
        <p className="mt-2">
          Sous-traitant technique : <em>[À COMPLÉTER : hébergeur, ex. OVH]</em>,
          situé dans l'Union européenne.
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Compte actif : durée de votre adhésion</li>
          <li>Compte inactif : suppression ou anonymisation après 3 ans d'inactivité</li>
          <li>Messages privés : conservés tant que les deux comptes existent</li>
          <li>Logs techniques : 12 mois maximum</li>
        </ul>
      </Section>

      <Section title="6. Vos droits">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>
            <strong>Accès et portabilité</strong> : téléchargez l'intégralité de
            vos données au format JSON depuis votre profil
          </li>
          <li>
            <strong>Rectification</strong> : modifiez vos informations depuis votre
            profil
          </li>
          <li>
            <strong>Effacement</strong> : supprimez votre compte depuis votre
            profil (les données restent anonymisées pour préserver l'historique
            des plannings)
          </li>
          <li>
            <strong>Opposition et limitation</strong> : quittez une association
            sans supprimer votre compte
          </li>
          <li>
            <strong>Réclamation</strong> : auprès de la CNIL ({" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-500"
            >
              www.cnil.fr
            </a>
            )
          </li>
        </ul>
      </Section>

      <Section title="7. Sécurité">
        <p>
          Les mots de passe sont stockés sous forme hachée (algorithme PBKDF2).
          Les communications sont chiffrées via HTTPS en production.
          L'authentification utilise des jetons JWT à courte durée de vie.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          ManyOPlan n'utilise pas de cookies de suivi ni de mesure d'audience.
          Seul un stockage local (localStorage) est utilisé pour conserver votre
          session connectée. Aucune information n'est partagée avec des tiers à
          des fins publicitaires.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Pour toute question ou pour exercer vos droits, écrivez à{" "}
          <em>[À COMPLÉTER : email de contact RGPD]</em>.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
